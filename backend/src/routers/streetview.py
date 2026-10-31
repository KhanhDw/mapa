"""Endpoint đọc street view: danh sách điểm trong bbox, chi tiết 1 ảnh."""
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import settings
from ..db import get_pool
from ..utils import parse_link_positions, validate_bbox

router = APIRouter(prefix="/api/streetview", tags=["streetview"])

_COLS = """
    id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
    image_url, heading, next_ids, link_positions
"""


def _to_feature(row) -> dict:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [row["lng"], row["lat"]]},
        "properties": {
            "id": row["id"],
            "image_url": row["image_url"],
            "heading": row["heading"],
            "next_ids": row["next_ids"] or [],
            "link_positions": parse_link_positions(row["link_positions"]),
        },
    }


@router.get("/points")
async def get_streetview_points(
    minx: float | None = Query(None),
    miny: float | None = Query(None),
    maxx: float | None = Query(None),
    maxy: float | None = Query(None),
    limit: int = Query(settings.MAX_FEATURES, ge=1, le=20000),
    pool: asyncpg.Pool = Depends(get_pool),
):
    if all(v is not None for v in (minx, miny, maxx, maxy)):
        validate_bbox(minx, miny, maxx, maxy)
        sql = f"""
            SELECT {_COLS}
            FROM public.streetview_images
            WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
            ORDER BY id
            LIMIT $5
        """
        params = (minx, miny, maxx, maxy, limit)
    else:
        sql = f"""
            SELECT {_COLS}
            FROM public.streetview_images
            ORDER BY id
            LIMIT $1
        """
        params = (limit,)

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    return {"type": "FeatureCollection", "features": [_to_feature(r) for r in rows]}


@router.get("/image/{image_id}")
async def get_streetview_image(
    image_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT {_COLS}, captured_at "
            "FROM public.streetview_images WHERE id = $1",
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
        "link_positions": parse_link_positions(row["link_positions"]),
        "captured_at": row["captured_at"].isoformat() if row["captured_at"] else None,
    }