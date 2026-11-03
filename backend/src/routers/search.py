import json
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import settings
from ..db import get_pool

logger = logging.getLogger(__name__)

router = APIRouter(tags=["search"])

_PLACE_SQL = r"""
    WITH matches AS (
        SELECT 'osm'::text AS source, osm_id::text AS id, name,
               fclass AS category, NULL::text AS address,
               ST_X(geom) AS lng, ST_Y(geom) AS lat,
               0 AS source_order
        FROM clean.places
        WHERE name ILIKE $1 ESCAPE '\'
        UNION ALL
        SELECT 'osm', osm_id::text, name, category, NULL::text,
               ST_X(geom), ST_Y(geom), 1
        FROM clean.pois
        WHERE name ILIKE $1 ESCAPE '\'
        UNION ALL
        SELECT 'user', id::text, name, category, address,
               ST_X(geom), ST_Y(geom), 2
        FROM user_data.pois
        WHERE name ILIKE $1 ESCAPE '\'
           OR address ILIKE $1 ESCAPE '\'
    )
    SELECT source, id, name, category, address, lng, lat
    FROM matches
    ORDER BY CASE WHEN name ILIKE $2 ESCAPE '\' THEN 0 ELSE 1 END,
             source_order, name
    LIMIT 10
"""

_ROAD_SQL = r"""
    SELECT osm_id::text AS id, name, fclass AS category, ref,
           ST_X(ST_Centroid(geom)) AS lng,
           ST_Y(ST_Centroid(geom)) AS lat,
           ST_AsGeoJSON(geom, 6) AS geometry,
           ST_XMin(ST_Envelope(geom)) AS west,
           ST_YMin(ST_Envelope(geom)) AS south,
           ST_XMax(ST_Envelope(geom)) AS east,
           ST_YMax(ST_Envelope(geom)) AS north
    FROM public.vietnam_roads
    WHERE name IS NOT NULL
      AND btrim(name) <> ''
      AND name ILIKE $1 ESCAPE '\'
    ORDER BY CASE WHEN name ILIKE $2 ESCAPE '\' THEN 0 ELSE 1 END,
             ST_Length(geom::geography) DESC
    LIMIT 8
"""


def _result_from_place(row: asyncpg.Record) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "kind": "place",
        "category": row["category"],
        "address": row["address"],
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "source": row["source"],
    }


def _result_from_road(row: asyncpg.Record) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "kind": "road",
        "category": row["category"],
        "address": row["ref"],
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "source": "osm",
        "geometry": json.loads(row["geometry"]),
        "bbox": [
            float(row["west"]),
            float(row["south"]),
            float(row["east"]),
            float(row["north"]),
        ],
    }


@router.get("/api/search")
async def search_map(
    q: str = Query(..., min_length=2, max_length=100),
    pool: asyncpg.Pool = Depends(get_pool),
):
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(422, "Nhập ít nhất 2 ký tự để tìm kiếm")

    escaped_query = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    contains_pattern = f"%{escaped_query}%"
    prefix_pattern = f"{escaped_query}%"

    try:
        async with pool.acquire() as conn:
            place_rows = await conn.fetch(
                _PLACE_SQL, contains_pattern, prefix_pattern
            )
            road_rows = await conn.fetch(
                _ROAD_SQL, contains_pattern, prefix_pattern
            )
    except Exception:
        logger.exception("map search failed q=%r", query)
        message = "Lỗi cơ sở dữ liệu" if not settings.is_dev else "Lỗi cơ sở dữ liệu (xem log server)"
        raise HTTPException(500, message)

    return {
        "results": [
            *(_result_from_place(row) for row in place_rows),
            *(_result_from_road(row) for row in road_rows),
        ]
    }
