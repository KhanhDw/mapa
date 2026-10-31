"""Thông tin tại 1 điểm: đường gần nhất, street view gần nhất, các POI quanh đó.

Performance note:
    Filter không gian dùng pattern 2 bước:
        geom && ST_Expand(pt, radius_m / 60000)   -- prefilter bằng GiST index (nhanh)
        AND ST_DWithin(geom::geography, pt::geography, radius_m)  -- exact distance
    Nếu chỉ dùng ST_DWithin(geom::geography,...) thì planner KHÔNG dùng được
    GiST index của geom và sẽ seq scan toàn bảng.

    Hệ số 60000.0 (≈ 60 km/deg) an toàn cho vĩ độ ≤ ~57°, dư sức cho Việt Nam.
"""
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import settings
from ..db import get_pool

logger = logging.getLogger(__name__)

router = APIRouter(tags=["point-info"])

_ROAD_SQL = """
    SELECT osm_id, name, ref, fclass, oneway, maxspeed,
           ST_Distance(geom::geography,
               ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
           ) AS distance_m
    FROM public.vietnam_roads
    WHERE geom && ST_Expand(
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326),
            $3::float8 / 60000.0
          )
      AND ST_DWithin(geom::geography,
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
    WHERE geom && ST_Expand(
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326),
            $3::float8 / 60000.0
          )
      AND ST_DWithin(geom::geography,
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
            $3::float8)
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)
    LIMIT 1
"""

# POI = public.pois (nguồn OSM) + user_data.pois (người dùng thêm).
# Hai bảng dùng hai sequence riêng nên id có thể trùng -> luôn trả kèm "source".
_POI_SQL = """
    WITH ref AS (
        SELECT ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326) AS pt
    ),
    cand AS (
        SELECT 'osm'::text AS source, p.id, p.name, p.category, p.geom,
               0 AS photo_count
        FROM public.pois p CROSS JOIN ref
        WHERE p.geom && ST_Expand(ref.pt, $3::float8 / 60000.0)
          AND ST_DWithin(p.geom::geography, ref.pt::geography, $3::float8)
        UNION ALL
        SELECT 'user'::text, u.id, u.name, u.category, u.geom,
               (SELECT count(*)::int FROM user_data.poi_photos ph WHERE ph.poi_id = u.id)
        FROM user_data.pois u CROSS JOIN ref
        WHERE u.geom && ST_Expand(ref.pt, $3::float8 / 60000.0)
          AND ST_DWithin(u.geom::geography, ref.pt::geography, $3::float8)
    ),
    top AS (
        SELECT c.*, ST_Distance(c.geom::geography, ref.pt::geography) AS distance_m
        FROM cand c CROSS JOIN ref
        ORDER BY distance_m, c.source, c.id
        LIMIT $4
    )
    SELECT t.source, t.id, t.name, t.category, t.photo_count,
           ST_X(t.geom) AS lng, ST_Y(t.geom) AS lat, t.distance_m,
           sv.id AS streetview_id, sv.dist AS streetview_distance_m
    FROM top t
    LEFT JOIN LATERAL (
        SELECT s.id,
               ST_Distance(s.geom::geography, t.geom::geography) AS dist
        FROM public.streetview_images s
        WHERE s.geom && ST_Expand(t.geom, 100.0 / 60000.0)
          AND ST_DWithin(s.geom::geography, t.geom::geography, 100)
        ORDER BY s.geom <-> t.geom
        LIMIT 1
    ) sv ON TRUE
    ORDER BY t.distance_m, t.source, t.id
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
        "source": row["source"],                # "osm" | "user" -> khóa là (source, id)
        "id": int(row["id"]),
        "name": row["name"],
        "category": row["category"],
        "photo_count": int(row["photo_count"]),
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
    radius_m: float = Query(50, ge=10, le=1000),
    poi_limit: int = Query(10, ge=1, le=50),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        async with pool.acquire() as conn:
            road_row = await conn.fetchrow(_ROAD_SQL, lng, lat, radius_m)
            sv_row = await conn.fetchrow(_SV_SQL, lng, lat, radius_m)
            poi_rows = await conn.fetch(_POI_SQL, lng, lat, radius_m, poi_limit)
    except Exception:
        logger.exception("point-info failed lng=%s lat=%s radius=%s", lng, lat, radius_m)
        # Không leak SQL / schema ra client khi production
        msg = "DB error" if not settings.is_dev else "DB error (xem log server)"
        raise HTTPException(500, msg)

    return {
        "road": _to_road(road_row),
        "streetview": (
            {"id": int(sv_row["id"]), "distance_m": float(sv_row["distance_m"])}
            if sv_row else None
        ),
        "address": None,
        "pois": [_to_poi(r) for r in poi_rows],
    }