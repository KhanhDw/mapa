from contextlib import asynccontextmanager
import json
import os
from pathlib import Path

import asyncpg
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")
PANORAMAS_DIR = os.getenv("PANORAMAS_DIR", "data/panoramas")
MAX_FEATURES = 5000

_pool: asyncpg.Pool | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pool
    _pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=2,
        max_size=10,
        command_timeout=10,
    )
    async with _pool.acquire() as conn:
        has_pois = bool(
            await conn.fetchval("SELECT to_regclass('public.pois') IS NOT NULL")
        )
    print(f"[startup] Connected to PostGIS | pois table: {has_pois}")
    yield
    await _pool.close()
    _pool = None
    print("[shutdown] PostGIS pool closed")


app = FastAPI(lifespan=lifespan, title="Webmap API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/health")
async def health():
    if _pool is None:
        raise HTTPException(503, "DB pool not ready")
    async with _pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"status": "ok"}


# =====================================================
# STREET VIEW
# =====================================================
@app.get("/api/streetview/points")
async def get_streetview_points(
    minx: float | None = Query(None),
    miny: float | None = Query(None),
    maxx: float | None = Query(None),
    maxy: float | None = Query(None),
    limit: int = Query(MAX_FEATURES, ge=1, le=20000),
):
    if _pool is None:
        raise HTTPException(503, "DB not ready")

    if all(v is not None for v in (minx, miny, maxx, maxy)):
        if minx >= maxx or miny >= maxy:
            raise HTTPException(400, "bbox không hợp lệ")
        sql = """
            SELECT id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
                   image_url, heading, next_ids, link_positions
            FROM public.streetview_images
            WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
            ORDER BY id
            LIMIT $5
        """
        params = (minx, miny, maxx, maxy, limit)
    else:
        sql = """
            SELECT id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
                   image_url, heading, next_ids, link_positions
            FROM public.streetview_images
            ORDER BY id
            LIMIT $1
        """
        params = (limit,)

    async with _pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [r["lng"], r["lat"]],
                },
                "properties": {
                    "id": r["id"],
                    "image_url": r["image_url"],
                    "heading": r["heading"],
                    "next_ids": r["next_ids"] or [],
                    "link_positions": (
                        json.loads(r["link_positions"])
                        if isinstance(r["link_positions"], str)
                        else (r["link_positions"] or [])
                    ),
                },
            }
            for r in rows
        ],
    }


@app.get("/api/streetview/image/{image_id}")
async def get_streetview_image(image_id: int):
    if _pool is None:
        raise HTTPException(503, "DB not ready")

    async with _pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
                   image_url, heading, next_ids, link_positions, captured_at
            FROM public.streetview_images
            WHERE id = $1
            """,
            image_id,
        )

    if not row:
        raise HTTPException(404, "Ảnh không tồn tại")

    return {
        "id": row["id"],
        "lng": row["lng"],
        "lat": row["lat"],
        "image_url": row["image_url"],
        "heading": row["heading"],
        "next_ids": row["next_ids"] or [],
        "link_positions": (
            json.loads(row["link_positions"])
            if isinstance(row["link_positions"], str)
            else (row["link_positions"] or [])
        ),
        "captured_at": row["captured_at"].isoformat() if row["captured_at"] else None,
    }


# =====================================================
# POINT INFO
# =====================================================
@app.get("/api/point-info")
async def get_point_info(
    lng: float = Query(..., ge=-180, le=180),
    lat: float = Query(..., ge=-90, le=90),
    zoom: float = Query(13, ge=0, le=22),
    radius_m: float = Query(200, ge=10, le=2000),
    poi_limit: int = Query(10, ge=1, le=50),
):
    if _pool is None:
        raise HTTPException(503, "DB not ready")

    try:
        async with _pool.acquire() as conn:
            road_row = await conn.fetchrow(
                """
                SELECT osm_id, name, ref, fclass, oneway, maxspeed,
                       ST_Distance(geom::geography,
                           ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
                       ) AS distance_m
                FROM public.vietnam_roads
                WHERE ST_DWithin(geom::geography,
                        ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
                        $3::float8)
                ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)
                LIMIT 1
                """,
                lng, lat, radius_m,
            )

            sv_row = await conn.fetchrow(
                """
                SELECT id,
                       ST_Distance(geom::geography,
                           ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
                       ) AS distance_m
                FROM public.streetview_images
                WHERE ST_DWithin(geom::geography,
                        ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
                        $3::float8)
                ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)
                LIMIT 1
                """,
                lng, lat, radius_m,
            )

            poi_rows = await conn.fetch(
                """
                WITH ref AS (
                    SELECT ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326) AS pt
                )
                SELECT p.id, p.name, p.category,
                       ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat,
                       ST_Distance(p.geom::geography, ref.pt::geography) AS distance_m,
                       sv.id AS streetview_id, sv.dist AS streetview_distance_m
                FROM public.pois p CROSS JOIN ref
                LEFT JOIN LATERAL (
                    SELECT s.id,
                           ST_Distance(s.geom::geography, p.geom::geography) AS dist
                    FROM public.streetview_images s
                    WHERE ST_DWithin(s.geom::geography, p.geom::geography, 100)
                    ORDER BY s.geom <-> p.geom
                    LIMIT 1
                ) sv ON TRUE
                WHERE ST_DWithin(p.geom::geography, ref.pt::geography, $3::float8)
                ORDER BY p.geom <-> ref.pt
                LIMIT $4
                """,
                lng, lat, radius_m, poi_limit,
            )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            500, detail=f"DB error: {type(e).__name__}: {e}"
        )

    road = None
    if road_row:
        road = {
            "osm_id": road_row["osm_id"],
            "name": road_row["name"],
            "ref": road_row["ref"],
            "fclass": road_row["fclass"],
            "oneway": road_row["oneway"],
            "maxspeed": road_row["maxspeed"],
            "distance_m": float(road_row["distance_m"]),
        }

    streetview = (
        {"id": int(sv_row["id"]), "distance_m": float(sv_row["distance_m"])}
        if sv_row else None
    )

    pois = [
        {
            "id": int(r["id"]),
            "name": r["name"],
            "category": r["category"],
            "lng": float(r["lng"]),
            "lat": float(r["lat"]),
            "distance_m": float(r["distance_m"]),
            "streetview_id": (
                int(r["streetview_id"]) if r["streetview_id"] is not None else None
            ),
            "streetview_distance_m": (
                float(r["streetview_distance_m"])
                if r["streetview_distance_m"] is not None else None
            ),
        }
        for r in poi_rows
    ]

    return {
        "road": road,
        "streetview": streetview,
        "address": None,
        "pois": pois,
    }


# =====================================================
# STATIC
# =====================================================
os.makedirs(PANORAMAS_DIR, exist_ok=True)
app.mount("/panoramas", StaticFiles(directory=PANORAMAS_DIR), name="panoramas")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["backend"],
    )