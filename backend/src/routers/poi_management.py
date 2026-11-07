"""CRUD cho user_data.pois + đọc clean.pois (system, read-only).

Tách khỏi contribute.py để panel quản lý có endpoint riêng.
"""
import asyncio
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from pydantic import BaseModel, Field

from ..config import settings
from ..db import get_pool
from .contribute import (
    UserPoiIn,
    require_write_key,
    _media_url,
    _remove_files,
    BIGINT_MAX,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["poi-management"])


# ══════════════════════════════════════════════════════════════════════════
# USER POIs — full CRUD
# ══════════════════════════════════════════════════════════════════════════

@router.get("/api/user-pois")
async def list_user_pois(
    search: str | None = Query(None, max_length=200),
    category: str | None = Query(None, max_length=50),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """List user POIs có filter/pagination cho panel quản lý."""
    conditions: list[str] = []
    args: list = []

    if search and search.strip():
        args.append(f"%{search.strip()}%")
        conditions.append(
            f"(name ILIKE ${len(args)} OR address ILIKE ${len(args)})"
        )
    if category:
        args.append(category)
        conditions.append(f"category = ${len(args)}")

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""

    async with pool.acquire() as conn:
        total = await conn.fetchval(
            f"SELECT count(*) FROM user_data.pois{where}", *args
        )

        args_page = list(args) + [limit, offset]
        rows = await conn.fetch(
            f"""
            SELECT id, name, category, address, phone, description,
                   ST_X(geom) AS lng, ST_Y(geom) AS lat, created_at,
                   (SELECT count(*)::int FROM user_data.poi_photos
                    WHERE poi_id = p.id) AS photo_count,
                   (SELECT thumb_path FROM user_data.poi_photos
                    WHERE poi_id = p.id ORDER BY id LIMIT 1) AS first_thumb
            FROM user_data.pois p
            {where}
            ORDER BY id DESC
            LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}
            """,
            *args_page,
        )

    return {
        "items": [
            {
                "id": int(r["id"]),
                "source": "user",
                "name": r["name"],
                "category": r["category"],
                "address": r["address"],
                "phone": r["phone"],
                "description": r["description"],
                "lng": float(r["lng"]),
                "lat": float(r["lat"]),
                "created_at": r["created_at"].isoformat(),
                "photo_count": int(r["photo_count"]),
                "thumb_url": _media_url(r["first_thumb"]),
            }
            for r in rows
        ],
        "total": int(total),
    }


@router.put("/api/user-pois/{poi_id}", dependencies=[Depends(require_write_key)])
async def update_user_poi(
    body: UserPoiIn,
    poi_id: int = Path(ge=1, le=BIGINT_MAX),
    pool: asyncpg.Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE user_data.pois
            SET name = $2, category = $3, address = $4, phone = $5,
                description = $6,
                geom = ST_SetSRID(ST_MakePoint($7::float8, $8::float8), 4326)
            WHERE id = $1
            RETURNING id, name, category, address, phone, description,
                      ST_X(geom) AS lng, ST_Y(geom) AS lat, created_at
            """,
            poi_id, body.name, body.category, body.address, body.phone,
            body.description, body.lng, body.lat,
        )
    if not row:
        raise HTTPException(404, "Không tìm thấy địa điểm")
    return {
        "id": int(row["id"]),
        "source": "user",
        "name": row["name"],
        "category": row["category"],
        "address": row["address"],
        "phone": row["phone"],
        "description": row["description"],
        "lng": float(row["lng"]),
        "lat": float(row["lat"]),
        "created_at": row["created_at"].isoformat(),
    }


@router.delete(
    "/api/user-pois/{poi_id}",
    status_code=204,
    dependencies=[Depends(require_write_key)],
)
async def delete_user_poi(
    poi_id: int = Path(ge=1, le=BIGINT_MAX),
    pool: asyncpg.Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        # Lấy danh sách file trước khi cascade DELETE
        photos = await conn.fetch(
            "SELECT file_path, thumb_path FROM user_data.poi_photos WHERE poi_id = $1",
            poi_id,
        )
        deleted = await conn.fetchval(
            "DELETE FROM user_data.pois WHERE id = $1 RETURNING id", poi_id
        )

    if deleted is None:
        raise HTTPException(404, "Không tìm thấy địa điểm")

    # Xóa file vật lý (sau DB delete — orphan vô hại)
    paths = []
    for p in photos:
        if p["file_path"]:
            paths.append(settings.USER_MEDIA_DIR / p["file_path"])
        if p["thumb_path"]:
            paths.append(settings.USER_MEDIA_DIR / p["thumb_path"])
    if paths:
        await asyncio.to_thread(_remove_files, paths)

    return Response(status_code=204)


@router.delete(
    "/api/user-pois/{poi_id}/photos/{photo_id}",
    status_code=204,
    dependencies=[Depends(require_write_key)],
)
async def delete_poi_photo(
    poi_id: int = Path(ge=1, le=BIGINT_MAX),
    photo_id: int = Path(ge=1, le=BIGINT_MAX),
    pool: asyncpg.Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT file_path, thumb_path FROM user_data.poi_photos "
            "WHERE id = $1 AND poi_id = $2",
            photo_id, poi_id,
        )
        if not row:
            raise HTTPException(404, "Ảnh không tồn tại")
        await conn.execute(
            "DELETE FROM user_data.poi_photos WHERE id = $1", photo_id
        )

    paths = []
    if row["file_path"]:
        paths.append(settings.USER_MEDIA_DIR / row["file_path"])
    if row["thumb_path"]:
        paths.append(settings.USER_MEDIA_DIR / row["thumb_path"])
    if paths:
        await asyncio.to_thread(_remove_files, paths)

    return Response(status_code=204)


# ══════════════════════════════════════════════════════════════════════════
# SYSTEM POIs — read-only từ clean.pois (materialized view)
# ══════════════════════════════════════════════════════════════════════════

@router.get("/api/system-pois")
async def list_system_pois(
    search: str | None = Query(None, max_length=200),
    fclass: str | None = Query(None, max_length=50),
    category: str | None = Query(None, max_length=50),
    has_name: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """List OSM POIs (read-only, không cho sửa/xóa)."""
    conditions: list[str] = []
    args: list = []

    if search and search.strip():
        args.append(f"%{search.strip()}%")
        conditions.append(f"name ILIKE ${len(args)}")
    if fclass:
        args.append(fclass)
        conditions.append(f"fclass = ${len(args)}")
    if category:
        args.append(category)
        conditions.append(f"category = ${len(args)}")
    if has_name is not None:
        args.append(has_name)
        conditions.append(f"has_name = ${len(args)}")

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""

    async with pool.acquire() as conn:
        total = await conn.fetchval(
            f"SELECT count(*) FROM clean.pois{where}", *args
        )
        args_page = list(args) + [limit, offset]
        rows = await conn.fetch(
            f"""
            SELECT osm_id, name, category, fclass, has_name,
                   ST_X(geom) AS lng, ST_Y(geom) AS lat
            FROM clean.pois
            {where}
            ORDER BY osm_id
            LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}
            """,
            *args_page,
        )

    return {
        "items": [
            {
                "id": r["osm_id"],
                "source": "osm",
                "name": r["name"],
                "category": r["category"],
                "fclass": r["fclass"],
                "has_name": bool(r["has_name"]),
                "lng": float(r["lng"]),
                "lat": float(r["lat"]),
            }
            for r in rows
        ],
        "total": int(total),
    }