"""Thông tin tại 1 điểm: đường gần nhất, street view gần nhất, các POI quanh đó.

Nguồn POI (spec DB §5):
    - clean.pois (74k rows) — OSM thật, category VN + fclass EN
    - user_data.pois (user contribute) — category EN, không có fclass
    BỎ public.pois — chỉ là test data, đã xoá.

Performance:
    geom && ST_Expand(pt, radius_m / 60000)   -- prefilter GiST
    AND ST_DWithin(geom::geography, pt::geography, radius_m)  -- exact
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

# Trụ điện gần điểm click. Bán kính riêng vì trụ thưa hơn đường rất nhiều —
# 50m (radius_m mặc định) thường trả rỗng, 200m hợp lý cho UX.
# ORDER BY geom <-> pt kích hoạt KNN scan trên GiST index.
_POLES_SQL = """
    SELECT id, pole_code, route, status, detail,
           ST_X(geom) AS lng, ST_Y(geom) AS lat,
           ST_Distance(geom::geography,
               ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
           ) AS distance_m
    FROM user_data.electric_poles
    WHERE geom && ST_Expand(
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326),
            $3::float8 / 60000.0
          )
      AND ST_DWithin(geom::geography,
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
            $3::float8)
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)
    LIMIT $4
"""

# clean.pois: osm_id (varchar) làm id, category VN, fclass EN.
# user_data.pois: id (bigint), category EN, fclass NULL.
# Khóa POI là cặp (source, id) — OSM và user dùng id hệ riêng.
_POI_SQL = """
    WITH ref AS (
        SELECT ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326) AS pt
    ),
    cand AS (
        -- OSM POI (74k real data từ clean.pois materialized view)
        SELECT 'osm'::text AS source,
               p.osm_id::text AS id,
               p.name,
               p.category,                  -- VN: an_uong, y_te, ...
               p.fclass,                    -- EN: restaurant, cafe, pharmacy, ...
               p.geom,
               0 AS photo_count
        FROM clean.pois p CROSS JOIN ref
        WHERE p.geom && ST_Expand(ref.pt, $3::float8 / 60000.0)
          AND ST_DWithin(p.geom::geography, ref.pt::geography, $3::float8)
          AND (
                p.has_name = true                                    -- ưu tiên có tên
                OR p.fclass IN (                                     -- hoặc fclass quan trọng
                    'fuel', 'parking', 'charging_station',
                    'hospital', 'clinic', 'pharmacy',
                    'school', 'university', 'kindergarten',
                    'bank', 'atm', 'post_office', 'police', 'fire_station',
                    'supermarket', 'convenience', 'mall', 'market_place',
                    'hotel', 'motel', 'hostel', 'guesthouse',
                    'attraction', 'museum', 'viewpoint', 'tourist_info'
                )
            )
        UNION ALL
        -- User POI
        SELECT 'user'::text,
               u.id::text,
               u.name,
               u.category,                  -- EN: cafe, hotel, ...
               NULL::varchar(28) AS fclass, -- user POI không có fclass
               u.geom,
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
    SELECT t.source, t.id, t.name, t.category, t.fclass, t.photo_count,
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
        "source": row["source"],                 # "osm" | "user"
        "id": row["id"],                         # string (osm_id hoặc user id as text)
        "name": row["name"],
        "category": row["category"],             # VN (osm) hoặc EN (user)
        "fclass": row["fclass"],                 # EN (osm) hoặc null (user)
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


def _to_nearby_pole(row) -> dict:
    return {
        "id": int(row["id"]),
        "pole_code": row["pole_code"],
        "route": row["route"],
        "status": row["status"],
        "detail": row["detail"],
        "lng": float(row["lng"]),
        "lat": float(row["lat"]),
        "distance_m": float(row["distance_m"]),
    }


@router.get("/api/point-info")
async def get_point_info(
    lng: float = Query(..., ge=-180, le=180),
    lat: float = Query(..., ge=-90, le=90),
    radius_m: float = Query(50, ge=10, le=1000),
    poi_limit: int = Query(10, ge=1, le=50),
    pole_radius_m: float = Query(200, ge=10, le=2000),
    pole_limit: int = Query(5, ge=1, le=20),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        async with pool.acquire() as conn:
            road_row = await conn.fetchrow(_ROAD_SQL, lng, lat, radius_m)
            sv_row = await conn.fetchrow(_SV_SQL, lng, lat, radius_m)
            poi_rows = await conn.fetch(_POI_SQL, lng, lat, radius_m, poi_limit)
            pole_rows = await conn.fetch(
                _POLES_SQL, lng, lat, pole_radius_m, pole_limit
            )
    except Exception:
        logger.exception(
            "point-info failed lng=%s lat=%s radius=%s", lng, lat, radius_m
        )
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
        "nearby_poles": [_to_nearby_pole(r) for r in pole_rows],
    }