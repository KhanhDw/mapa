# backend\src\routers\point_info.py
"""Thông tin tại 1 điểm: đơn vị hành chính (xã/phường), đường gần nhất,
street view gần nhất, các POI và trụ điện quanh đó.

Đồng bộ schema DB v2:
- user_data.vietnam_wards_2025 : ranh giới hành chính cấp xã/phường (ST_Contains / ST_Intersects)
- public.vietnam_roads         : id, name, fclass, geom (bỏ osm_id, ref, oneway, maxspeed)
- public.pois                  : id, name, fclass, category, geom (thay thế clean.pois)
- user_data.pois               : id, name, category, address, phone, description, geom
- public.streetview_images     : id, file_path, heading, pitch, geom, created_at
- user_data.electric_poles     : id, pole_code, route, status, detail, geom
"""
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import settings
from ..db import get_pool

logger = logging.getLogger(__name__)

router = APIRouter(tags=["point-info"])

_WARD_SQL = """
    SELECT ma, tenhc, loai, matinh, tentinh, matinhxa,
           dansonguoi, trungtamhc, dientichkm2, truocsapnhap
    FROM user_data.vietnam_wards_2025
    WHERE geom && ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)
      AND ST_Intersects(geom, ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326))
    LIMIT 1
"""

_ROAD_SQL = """
    SELECT id, name, fclass,
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
    SELECT id, file_path, heading, pitch,
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

_POI_SQL = """
    WITH ref AS (
        SELECT ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326) AS pt
    ),
    cand AS (
        -- System / OSM POI từ public.pois
        SELECT 'osm'::text AS source,
               p.id::text AS id,
               p.name,
               p.category,
               p.fclass,
               p.geom,
               0 AS photo_count
        FROM public.pois p CROSS JOIN ref
        WHERE p.geom && ST_Expand(ref.pt, $3::float8 / 60000.0)
          AND ST_DWithin(p.geom::geography, ref.pt::geography, $3::float8)
          AND (
                (p.name IS NOT NULL AND btrim(p.name) <> '')
                OR p.fclass IN (
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
        -- User POI từ user_data.pois
        SELECT 'user'::text AS source,
               u.id::text AS id,
               u.name,
               u.category,
               NULL::text AS fclass,
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


def _to_ward(row) -> dict | None:
    if not row:
        return None
    full_name = f"{row['loai']} {row['tenhc']}".strip() if row["loai"] else row["tenhc"]
    return {
        "ma": row["ma"],
        "tenhc": row["tenhc"],
        "loai": row["loai"],
        "full_name": full_name,
        "matinh": row["matinh"],
        "tentinh": row["tentinh"],
        "matinhxa": row["matinhxa"],
        "dansonguoi": row["dansonguoi"],
        "trungtamhc": row["trungtamhc"],
        "dientichkm2": row["dientichkm2"],
        "truocsapnhap": row["truocsapnhap"],
    }


def _to_road(row) -> dict | None:
    if not row:
        return None
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "fclass": row["fclass"],
        "distance_m": float(row["distance_m"]),
    }


def _to_poi(row) -> dict:
    return {
        "source": row["source"],
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "fclass": row["fclass"],
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
            ward_row = await conn.fetchrow(_WARD_SQL, lng, lat)
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

    ward_info = _to_ward(ward_row)
    address_label = (
        f"{ward_info['full_name']}, {ward_info['tentinh']}"
        if ward_info and ward_info.get("tentinh")
        else (ward_info["full_name"] if ward_info else None)
    )

    return {
        "ward": ward_info,
        "road": _to_road(road_row),
        "streetview": (
            {
                "id": int(sv_row["id"]),
                "file_path": sv_row["file_path"],
                "heading": float(sv_row["heading"] or 0),
                "pitch": float(sv_row["pitch"] or 0),
                "distance_m": float(sv_row["distance_m"]),
            }
            if sv_row else None
        ),
        "address": address_label,
        "pois": [_to_poi(r) for r in poi_rows],
        "nearby_poles": [_to_nearby_pole(r) for r in pole_rows],
    }
