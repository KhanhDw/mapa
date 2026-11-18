
# backend/src/routers/search.py

"""Tìm kiếm hợp nhất: Đơn vị hành chính, POI và Đường.

Đồng bộ schema DB v2:
- user_data.vietnam_wards_2025
- public.pois
- user_data.pois
- public.vietnam_roads
"""

import json
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import settings
from ..db import get_pool

logger = logging.getLogger(__name__)

router = APIRouter(tags=["search"])


# --------------------------------------------------
# PLACE SEARCH
# --------------------------------------------------

_PLACE_SQL = r"""
    WITH matches AS (

        -- 1. Đơn vị hành chính xã/phường
        SELECT
            'admin'::text AS source,
            COALESCE(ma, tenhc)::text AS id,

            CASE
                WHEN loai IS NOT NULL AND btrim(loai) <> ''
                THEN loai || ' ' || tenhc
                ELSE tenhc
            END AS name,

            COALESCE(loai, 'ward')::text AS category,
            tentinh AS address,

            COALESCE(
                CASE
                    WHEN NULLIF(btrim(kinhdo), '') ~
                        '^-?[0-9]+(\.[0-9]+)?$'
                    THEN btrim(kinhdo)::float8
                    ELSE NULL
                END,
                ST_X(ST_PointOnSurface(geom))
            ) AS lng,

            COALESCE(
                CASE
                    WHEN NULLIF(btrim(vido), '') ~
                        '^-?[0-9]+(\.[0-9]+)?$'
                    THEN btrim(vido)::float8
                    ELSE NULL
                END,
                ST_Y(ST_PointOnSurface(geom))
            ) AS lat,

            0 AS source_order

        FROM user_data.vietnam_wards_2025

        WHERE tenhc ILIKE $1
           OR tentinh ILIKE $1

        UNION ALL

        -- 2. System POIs
        SELECT
            'osm'::text AS source,
            id::text AS id,
            name,
            COALESCE(category, fclass, 'poi')::text AS category,
            NULL::text AS address,
            ST_X(geom) AS lng,
            ST_Y(geom) AS lat,
            1 AS source_order

        FROM public.pois

        WHERE name IS NOT NULL
          AND btrim(name) <> ''
          AND name ILIKE $1

        UNION ALL

        -- 3. User POIs
        SELECT
            'user'::text AS source,
            id::text AS id,
            name,
            category,
            address,
            ST_X(geom) AS lng,
            ST_Y(geom) AS lat,
            2 AS source_order

        FROM user_data.pois

        WHERE name ILIKE $1
           OR address ILIKE $1
    )

    SELECT
        source,
        id,
        name,
        category,
        address,
        lng,
        lat

    FROM matches

    WHERE lng IS NOT NULL
      AND lat IS NOT NULL

    ORDER BY
        CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
        source_order,
        name

    LIMIT 12
"""


# --------------------------------------------------
# ROAD SEARCH
# --------------------------------------------------

_ROAD_SQL = r"""
    SELECT
        id::text AS id,
        name,
        fclass AS category,

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
      AND name ILIKE $1

    ORDER BY
        CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
        ST_Length(geom::geography) DESC

    LIMIT 8
"""


# --------------------------------------------------
# RESULT MAPPING
# --------------------------------------------------

def _result_from_place(row: asyncpg.Record) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "kind": "admin" if row["source"] == "admin" else "place",
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
        "address": None,
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


# --------------------------------------------------
# SEARCH ENDPOINT
# --------------------------------------------------

@router.get("/api/search")
async def search_map(
    q: str = Query(..., min_length=2, max_length=100),
    pool: asyncpg.Pool = Depends(get_pool),
):
    query = q.strip()

    if len(query) < 2:
        raise HTTPException(
            422,
            "Nhập ít nhất 2 ký tự để tìm kiếm",
        )

    # Escape ký tự đặc biệt của LIKE
    escaped_query = (
        query
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )

    contains_pattern = f"%{escaped_query}%"
    prefix_pattern = f"{escaped_query}%"

    try:
        async with pool.acquire() as conn:

            place_rows = await conn.fetch(
                _PLACE_SQL,
                contains_pattern,
                prefix_pattern,
            )

            road_rows = await conn.fetch(
                _ROAD_SQL,
                contains_pattern,
                prefix_pattern,
            )

    except Exception:
        logger.exception(
            "map search failed q=%r",
            query,
        )

        message = (
            "Lỗi cơ sở dữ liệu"
            if not settings.is_dev
            else "Lỗi cơ sở dữ liệu (xem log server)"
        )

        raise HTTPException(500, message)

    return {
        "results": [
            *(_result_from_place(row) for row in place_rows),
            *(_result_from_road(row) for row in road_rows),
        ]
    }
