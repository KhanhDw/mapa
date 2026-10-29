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

# Load .env từ thư mục backend/ (cùng chỗ với main.py)
load_dotenv(Path(__file__).resolve().parent / ".env")

# ---- Cấu hình (đọc từ env, có fallback cho dev local) ----
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://tile_reader:mat_khau_tile_reader@localhost:5432/webmap_db",
)
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
    print(f"[startup] Connected to PostGIS")
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


# =====================================================
# HEALTH
# =====================================================
@app.get("/health")
async def health():
    if _pool is None:
        raise HTTPException(503, "DB pool not ready")
    async with _pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"status": "ok"}


# =====================================================
# STREET VIEW — danh sách điểm ảnh 360
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

    # Bbox optional: nếu có thì filter, không thì trả tất cả (giới hạn limit)
    if all(v is not None for v in (minx, miny, maxx, maxy)):
        if minx >= maxx or miny >= maxy:
            raise HTTPException(400, "bbox không hợp lệ")
        sql = """
            SELECT id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
                   image_url, heading, next_ids, link_positions
            FROM streetview_images
            WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
            ORDER BY id
            LIMIT $5
        """
        params = (minx, miny, maxx, maxy, limit)
    else:
        sql = """
            SELECT id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
                   image_url, heading, next_ids, link_positions
            FROM streetview_images
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


# =====================================================
# STREET VIEW — chi tiết 1 ảnh (tuỳ chọn, tiện debug)
# =====================================================
@app.get("/api/streetview/image/{image_id}")
async def get_streetview_image(image_id: int):
    if _pool is None:
        raise HTTPException(503, "DB not ready")

    async with _pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
                   image_url, heading, next_ids, link_positions, captured_at
            FROM streetview_images
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
# STATIC FILES — phục vụ ảnh 360
# =====================================================
# Tạo thư mục nếu chưa có để tránh lỗi khởi động
os.makedirs(PANORAMAS_DIR, exist_ok=True)
app.mount("/panoramas", StaticFiles(directory=PANORAMAS_DIR), name="panoramas")


# =====================================================
# CHẠY DEV
# =====================================================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",       # ← string, không phải object
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["backend"],  # chỉ watch thư mục backend
    )