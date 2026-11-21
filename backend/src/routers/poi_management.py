
"""CRUD cho user_data.pois + đọc public.pois (system, read-only).

Đồng bộ schema DB v2:
- Thay thế clean.pois bằng public.pois
  (cột: id, name, fclass, category, geom).
"""

import asyncio
import logging

import asyncpg
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    Response,
)

from ..config import settings
from ..db import get_pool
from .contribute import (
    BIGINT_MAX,
    UserPoiIn,
    _media_url,
    _remove_files,
)
from .auth import get_current_user


logger = logging.getLogger(__name__)

router = APIRouter(tags=["poi-management"])


# ============================================================
# USER POIs — FULL CRUD
# ============================================================

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

    where = (
        " WHERE " + " AND ".join(conditions)
        if conditions
        else ""
    )

    async with pool.acquire() as conn:
        total = await conn.fetchval(
            f"""
            SELECT count(*)
            FROM user_data.pois
            {where}
            """,
            *args,
        )

        args_page = list(args) + [limit, offset]

        rows = await conn.fetch(
            f"""
            SELECT
                id,
                name,
                category,
                address,
                phone,
                description,
                ST_X(geom) AS lng,
                ST_Y(geom) AS lat,
                created_at,
                (
                    SELECT count(*)::int
                    FROM user_data.poi_photos
                    WHERE poi_id = p.id
                ) AS photo_count,
                (
                    SELECT thumb_path
                    FROM user_data.poi_photos
                    WHERE poi_id = p.id
                    ORDER BY id
                    LIMIT 1
                ) AS first_thumb
            FROM user_data.pois p
            {where}
            ORDER BY id DESC
            LIMIT ${len(args) + 1}
            OFFSET ${len(args) + 2}
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


# ============================================================
# UPDATE USER POI
# ============================================================

@router.put("/api/user-pois/{poi_id}")
async def update_user_poi(
    body: UserPoiIn,
    poi_id: int = Path(ge=1, le=BIGINT_MAX),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        async with conn.transaction():
            owner = await conn.fetchrow(
                """
                SELECT user_id
                FROM user_data.pois
                WHERE id = $1
                FOR UPDATE
                """,
                poi_id,
            )

            if owner is None:
                raise HTTPException(404, "Không tìm thấy địa điểm")

            _ensure_poi_access(owner, current_user)

            row = await conn.fetchrow(
                """
                UPDATE user_data.pois
                SET
                    name = $2,
                    category = $3,
                    address = $4,
                    phone = $5,
                    description = $6,
                    geom = ST_SetSRID(
                        ST_MakePoint($7::float8, $8::float8),
                        4326
                    )
                WHERE id = $1
                RETURNING
                    id,
                    name,
                    category,
                    address,
                    phone,
                    description,
                    ST_X(geom) AS lng,
                    ST_Y(geom) AS lat,
                    created_at
                """,
                poi_id,
                body.name,
                body.category,
                body.address,
                body.phone,
                body.description,
                body.lng,
                body.lat,
            )

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


# ============================================================
# DELETE USER POI
# ============================================================

@router.delete("/api/user-pois/{poi_id}", status_code=204)
async def delete_user_poi(
    poi_id: int = Path(ge=1, le=BIGINT_MAX),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    paths = []

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Khóa POI và kiểm tra quyền trước khi xóa.
            poi = await conn.fetchrow(
                """
                SELECT id, user_id
                FROM user_data.pois
                WHERE id = $1
                FOR UPDATE
                """,
                poi_id,
            )

            if poi is None:
                raise HTTPException(404, "Không tìm thấy địa điểm")

            _ensure_poi_access(poi, current_user)

            photos = await conn.fetch(
                """
                SELECT file_path, thumb_path
                FROM user_data.poi_photos
                WHERE poi_id = $1
                """,
                poi_id,
            )

            for photo in photos:
                if photo["file_path"]:
                    paths.append(
                        settings.USER_MEDIA_DIR / photo["file_path"]
                    )

                if photo["thumb_path"]:
                    paths.append(
                        settings.USER_MEDIA_DIR / photo["thumb_path"]
                    )

            deleted = await conn.fetchval(
                """
                DELETE FROM user_data.pois
                WHERE id = $1
                RETURNING id
                """,
                poi_id,
            )

            if deleted is None:
                raise HTTPException(404, "Không tìm thấy địa điểm")

    # Chỉ xóa file sau khi transaction commit thành công.
    if paths:
        await asyncio.to_thread(_remove_files, paths)

    return Response(status_code=204)


# ============================================================
# DELETE USER POI PHOTO
# ============================================================

@router.delete(
    "/api/user-pois/{poi_id}/photos/{photo_id}",
    status_code=204,
)
async def delete_poi_photo(
    poi_id: int = Path(ge=1, le=BIGINT_MAX),
    photo_id: int = Path(ge=1, le=BIGINT_MAX),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Khóa POI cha để xác minh ownership.
            poi = await conn.fetchrow(
                """
                SELECT user_id
                FROM user_data.pois
                WHERE id = $1
                FOR UPDATE
                """,
                poi_id,
            )

            if poi is None:
                raise HTTPException(404, "Ảnh không tồn tại")

            _ensure_poi_access(poi, current_user)

            row = await conn.fetchrow(
                """
                SELECT file_path, thumb_path
                FROM user_data.poi_photos
                WHERE id = $1 AND poi_id = $2
                FOR UPDATE
                """,
                photo_id,
                poi_id,
            )

            if row is None:
                raise HTTPException(404, "Ảnh không tồn tại")

            await conn.execute(
                """
                DELETE FROM user_data.poi_photos
                WHERE id = $1 AND poi_id = $2
                """,
                photo_id,
                poi_id,
            )

    # Chỉ xóa file sau khi transaction commit thành công.
    paths = []

    if row["file_path"]:
        paths.append(settings.USER_MEDIA_DIR / row["file_path"])

    if row["thumb_path"]:
        paths.append(settings.USER_MEDIA_DIR / row["thumb_path"])

    if paths:
        await asyncio.to_thread(_remove_files, paths)

    return Response(status_code=204)


# ============================================================
# SYSTEM POIs — READ ONLY
# ============================================================

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
    """List System/OSM POIs từ public.pois (read-only)."""

    conditions: list[str] = []
    args: list = []

    if search and search.strip():
        args.append(f"%{search.strip()}%")
        conditions.append(
            f"name ILIKE ${len(args)}"
        )

    if fclass:
        args.append(fclass)
        conditions.append(
            f"fclass = ${len(args)}"
        )

    if category:
        args.append(category)
        conditions.append(
            f"category = ${len(args)}"
        )

    if has_name is True:
        conditions.append(
            "(name IS NOT NULL AND btrim(name) <> '')"
        )

    elif has_name is False:
        conditions.append(
            "(name IS NULL OR btrim(name) = '')"
        )

    where = (
        " WHERE " + " AND ".join(conditions)
        if conditions
        else ""
    )

    # Không đếm toàn bảng OSM khi không có bộ lọc.
    total = None

    async with pool.acquire() as conn:

        if conditions:
            total = await conn.fetchval(
                f"""
                SELECT count(*)
                FROM public.pois
                {where}
                """,
                *args,
            )

        args_page = list(args) + [limit, offset]

        rows = await conn.fetch(
            f"""
            SELECT
                id,
                name,
                category,
                fclass,
                (
                    name IS NOT NULL
                    AND btrim(name) <> ''
                ) AS has_name,
                ST_X(geom) AS lng,
                ST_Y(geom) AS lat
            FROM public.pois
            {where}
            ORDER BY id
            LIMIT ${len(args) + 1}
            OFFSET ${len(args) + 2}
            """,
            *args_page,
        )

    return {
        "items": [
            {
                "id": str(r["id"]),
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
        "total": int(total) if total is not None else None,
    }


def _ensure_poi_access(row: asyncpg.Record, current_user: dict) -> None:
    is_owner = row["user_id"] == current_user["id"]
    is_admin = current_user["role"] == "admin"

    if not is_owner and not is_admin:
        raise HTTPException(
            403,
            "Bạn không có quyền chỉnh sửa địa điểm này",
        )