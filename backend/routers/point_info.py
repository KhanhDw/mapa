import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import get_pool

router = APIRouter(tags=["point-info"])

_ROAD_SQL = """
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
"""

_SV_SQL = """
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
"""

_POI_SQL = """
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
"""


def _to_road(row) -> dict | None:
    if not row:
        return None
    return {
        "osm_id": row["osm_id"],
        "name": row["name"],
        "ref": row["ref"],
        "fclass": row["fclass"],
        "oneway": row["oneway"],
        "maxspeed": row["maxspeed"],
        "distance_m": float(row["distance_m"]),
    }


def _to_poi(row) -> dict:
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "category": row["category"],
        "lng": float(row["lng"]),
        "lat": float(row["lat"]),
        "distance_m": float(row["distance_m"]),
        "streetview_id": (
            int(row["streetview_id"]) if row["streetview_id"] is not None else None
        ),
        "streetview_distance_m": (
            float(row["streetview_distance_m"])
            if row["streetview_distance_m"] is not None else None
        ),
    }


@router.get("/api/point-info")
async def get_point_info(
    lng: float = Query(..., ge=-180, le=180),
    lat: float = Query(..., ge=-90, le=90),
    zoom: float = Query(13, ge=0, le=22),
    radius_m: float = Query(50, ge=10, le=1000),
    poi_limit: int = Query(10, ge=1, le=50),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        async with pool.acquire() as conn:
            road_row = await conn.fetchrow(_ROAD_SQL, lng, lat, radius_m)
            sv_row = await conn.fetchrow(_SV_SQL, lng, lat, radius_m)
            poi_rows = await conn.fetch(_POI_SQL, lng, lat, radius_m, poi_limit)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=f"DB error: {type(e).__name__}: {e}")

    return {
        "road": _to_road(road_row),
        "streetview": (
            {"id": int(sv_row["id"]), "distance_m": float(sv_row["distance_m"])}
            if sv_row else None
        ),
        "address": None,
        "pois": [_to_poi(r) for r in poi_rows],
    }