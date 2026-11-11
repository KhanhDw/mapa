"""Endpoint street view: đọc (map), list quản lý, sửa, xóa ảnh panorama.

Endpoints:
    GET    /api/streetview/points         — list dạng GeoJSON cho map
    GET    /api/streetview/images         — list phân trang cho panel quản lý
    GET    /api/streetview/nearby         — tìm danh sách ảnh lân cận trong bán kính R (mét)
    GET    /api/streetview/image/{id}     — chi tiết 1 ảnh
    PUT    /api/streetview/image/{id}     — sửa heading / vị trí / captured_at / next_ids / link_positions
    PATCH  /api/streetview/batch-update   — cập nhật hàng loạt vị trí/thời gian chụp
    DELETE /api/streetview/image/{id}     — xóa + cleanup refs + file vật lý
"""
import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path

import asyncpg
from fastapi import (APIRouter, Depends, HTTPException, Path as PathParam,
                     Query, Response)
from pydantic import BaseModel, Field

from ..config import settings
from ..db import get_pool
from ..utils import parse_link_positions, validate_bbox
from .contribute import require_write_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/streetview", tags=["streetview"])

INT4_MAX = 2**31 - 1
PANORAMA_URL_PREFIX = "/panoramas/"

_COLS = """
    id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
    image_url, heading, next_ids, link_positions
"""
_COLS_DETAIL = _COLS + ", captured_at"


# ---------- helpers ----------
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


def _to_detail(row) -> dict:
    d = {
        "id": row["id"],
        "lng": row["lng"],
        "lat": row["lat"],
        "image_url": row["image_url"],
        "heading": row["heading"],
        "next_ids": row["next_ids"] or [],
        "link_positions": parse_link_positions(row["link_positions"]),
        "captured_at": row["captured_at"].isoformat() if row.get("captured_at") else None,
    }
    if "distance_meters" in row:
        d["distance_meters"] = round(float(row["distance_meters"]), 2)
    return d


def _file_path_from_url(image_url: str | None) -> Path | None:
    if not image_url or not image_url.startswith(PANORAMA_URL_PREFIX):
        return None
    name = image_url[len(PANORAMA_URL_PREFIX):]
    if not name or "/" in name or "\\" in name or ".." in name:
        return None

    base = settings.PANORAMAS_DIR.resolve()
    path = (base / name).resolve()
    if not path.is_relative_to(base):
        return None
    return path


def _unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.exception("Không xóa được file panorama %s", path)


def _escape_like(s: str) -> str:
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# ══════════════════════════════════════════════════════════════════════════
# ĐỌC
# ══════════════════════════════════════════════════════════════════════════

@router.get("/points")
async def get_streetview_points(
    minx: float | None = Query(None, ge=-180, le=180),
    miny: float | None = Query(None, ge=-90, le=90),
    maxx: float | None = Query(None, ge=-180, le=180),
    maxy: float | None = Query(None, ge=-90, le=90),
    limit: int = Query(settings.MAX_FEATURES, ge=1, le=20000),
    pool: asyncpg.Pool = Depends(get_pool),
):
    bbox = (minx, miny, maxx, maxy)
    provided = sum(v is not None for v in bbox)

    if provided not in (0, 4):
        raise HTTPException(400, "bbox cần đủ 4 tham số: minx, miny, maxx, maxy")

    if provided == 4:
        validate_bbox(minx, miny, maxx, maxy)
        rows = await pool.fetch(
            f"""
            SELECT {_COLS}
            FROM public.streetview_images
            WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
            ORDER BY id
            LIMIT $5
            """,
            minx, miny, maxx, maxy, limit + 1,
        )
    else:
        rows = await pool.fetch(
            f"""
            SELECT {_COLS}
            FROM public.streetview_images
            ORDER BY id
            LIMIT $1
            """,
            limit + 1,
        )

    truncated = len(rows) > limit
    return {
        "type": "FeatureCollection",
        "features": [_to_feature(r) for r in rows[:limit]],
        "truncated": truncated,
    }


@router.get("/images")
async def list_streetview_images(
    search: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    pool: asyncpg.Pool = Depends(get_pool),
):
    args: list = []
    where = ""

    q = (search or "").strip()
    if q:
        args.append(f"%{_escape_like(q)}%")
        url_cond = f"image_url ILIKE ${len(args)} ESCAPE '\\'"
        if q.isascii() and q.isdigit() and int(q) <= INT4_MAX:
            args.append(int(q))
            where = f" WHERE id = ${len(args)} OR {url_cond}"
        else:
            where = f" WHERE {url_cond}"

    async with pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT count(*) FROM public.streetview_images" + where, *args
        )
        # Sửa lại chỗ này: thêm khoảng trắng rõ ràng trước ORDER BY, LIMIT và OFFSET
        rows = await conn.fetch(
            f"SELECT {_COLS_DETAIL} FROM public.streetview_images "
            f"{where} ORDER BY id DESC "
            f"LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}",
            *args, limit, offset,
        )

    return {"items": [_to_detail(r) for r in rows], "total": int(total)}


@router.get("/nearby")
async def get_nearby_streetview_images(
    lng: float = Query(..., ge=-180, le=180),
    lat: float = Query(..., ge=-90, le=90),
    radius: float = Query(50.0, ge=1.0, le=500.0, description="Bán kính tìm kiếm (mét)"),
    exclude_id: int | None = Query(None, ge=1, le=INT4_MAX),
    limit: int = Query(20, ge=1, le=50),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Lấy danh sách các ảnh panorama xung quanh toạ độ (lng, lat) trong bán kính radius (mét)."""
    exclude_cond = "AND id != $4" if exclude_id else ""
    args = [lng, lat, radius]
    if exclude_id:
        args.append(exclude_id)

    query = f"""
        SELECT {_COLS_DETAIL},
               ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
        FROM public.streetview_images
        WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        {exclude_cond}
        ORDER BY distance_meters ASC
        LIMIT ${len(args) + 1}
    """
    rows = await pool.fetch(query, *args, limit)
    return {"items": [_to_detail(r) for r in rows]}


@router.get("/image/{image_id}")
async def get_streetview_image(
    image_id: int = PathParam(ge=1, le=INT4_MAX),
    pool: asyncpg.Pool = Depends(get_pool),
):
    row = await pool.fetchrow(
        f"SELECT {_COLS_DETAIL} FROM public.streetview_images WHERE id = $1",
        image_id,
    )
    if not row:
        raise HTTPException(404, "Ảnh không tồn tại")
    return _to_detail(row)


# ══════════════════════════════════════════════════════════════════════════
# GHI
# ══════════════════════════════════════════════════════════════════════════

class StreetViewUpdate(BaseModel):
    heading: float | None = Field(default=None, ge=0, lt=360)
    lng: float | None = Field(default=None, ge=-180, le=180)
    lat: float | None = Field(default=None, ge=-90, le=90)
    captured_at: datetime | None = None
    next_ids: list[int] | None = None
    link_positions: list[dict] | None = None


class BatchUpdateInput(BaseModel):
    ids: list[int] = Field(..., min_length=1)
    delta_lng: float | None = None
    delta_lat: float | None = None
    captured_at: datetime | None = None


@router.put("/image/{image_id}", dependencies=[Depends(require_write_key)])
async def update_streetview_image(
    body: StreetViewUpdate,
    image_id: int = PathParam(ge=1, le=INT4_MAX),
    pool: asyncpg.Pool = Depends(get_pool),
):
    sent = body.model_fields_set
    sets: list[str] = []
    args: list = [image_id]

    if "heading" in sent:
        args.append(body.heading)
        sets.append(f"heading = ${len(args)}")

    has_lng = "lng" in sent and body.lng is not None
    has_lat = "lat" in sent and body.lat is not None
    if has_lng and has_lat:
        args.extend([body.lng, body.lat])
        sets.append(
            f"geom = ST_SetSRID(ST_MakePoint(${len(args) - 1}::float8, "
            f"${len(args)}::float8), 4326)"
        )
    elif has_lng or has_lat or "lng" in sent or "lat" in sent:
        raise HTTPException(400, "Cần cung cấp cả lng và lat nếu muốn đổi vị trí")

    if "captured_at" in sent:
        args.append(body.captured_at)
        sets.append(f"captured_at = ${len(args)}")

    if "next_ids" in sent:
        args.append(body.next_ids or [])
        sets.append(f"next_ids = ${len(args)}")

    if "link_positions" in sent:
        args.append(json.dumps(body.link_positions or []))
        sets.append(f"link_positions = ${len(args)}::jsonb")

    if not sets:
        raise HTTPException(400, "Không có trường nào để cập nhật")

    row = await pool.fetchrow(
        f"""
        UPDATE public.streetview_images
        SET {', '.join(sets)}
        WHERE id = $1
        RETURNING {_COLS_DETAIL}
        """,
        *args,
    )
    if not row:
        raise HTTPException(404, "Ảnh không tồn tại")
    return _to_detail(row)


@router.patch("/batch-update", dependencies=[Depends(require_write_key)])
async def batch_update_streetview(
    body: BatchUpdateInput,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Cập nhật hàng loạt tọa độ hoặc thời gian chụp cho nhiều ảnh cùng lúc."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            if body.delta_lng is not None or body.delta_lat is not None:
                dlng = body.delta_lng or 0.0
                dlat = body.delta_lat or 0.0
                await conn.execute(
                    """
                    UPDATE public.streetview_images
                    SET geom = ST_SetSRID(ST_MakePoint(ST_X(geom) + $1, ST_Y(geom) + $2), 4326)
                    WHERE id = ANY($3)
                    """,
                    dlng, dlat, body.ids,
                )
            if body.captured_at is not None:
                await conn.execute(
                    """
                    UPDATE public.streetview_images
                    SET captured_at = $1
                    WHERE id = ANY($2)
                    """,
                    body.captured_at, body.ids,
                )
    return {"updated_count": len(body.ids)}


@router.delete(
    "/image/{image_id}",
    status_code=204,
    dependencies=[Depends(require_write_key)],
)
async def delete_streetview_image(
    image_id: int = PathParam(ge=1, le=INT4_MAX),
    pool: asyncpg.Pool = Depends(get_pool),
):
    file_to_remove: Path | None = None

    async with pool.acquire() as conn:
        async with conn.transaction():
            # 1. Kiểm tra ảnh tồn tại
            row = await conn.fetchrow(
                "SELECT image_url FROM public.streetview_images "
                "WHERE id = $1 FOR UPDATE",
                image_id,
            )
            if not row:
                raise HTTPException(404, "Ảnh không tồn tại")

            # 2. Tìm các ảnh khác có chứa image_id trong mảng next_ids
            # Sử dụng cú pháp toán tử của PostgreSQL cho mảng: $1 = ANY(next_ids)
            refs = await conn.fetch(
                "SELECT id, next_ids, link_positions "
                "FROM public.streetview_images "
                "WHERE $1 = ANY(next_ids) FOR UPDATE",
                image_id,
            )
            
            for ref in refs:
                old_next: list[int] = list(ref["next_ids"] or [])
                old_links = parse_link_positions(ref["link_positions"])

                new_next: list[int] = []
                new_links: list = []
                for i, nid in enumerate(old_next):
                    if nid == image_id:
                        continue
                    new_next.append(nid)
                    if i < len(old_links):
                        new_links.append(old_links[i])

                await conn.execute(
                    "UPDATE public.streetview_images "
                    "SET next_ids = $2, link_positions = $3::jsonb "
                    "WHERE id = $1",
                    ref["id"], new_next, json.dumps(new_links),
                )

            # 3. Xóa bản ghi trong database
            await conn.execute(
                "DELETE FROM public.streetview_images WHERE id = $1", image_id
            )

            # 4. Kiểm tra xem file vật lý còn được dùng bởi ảnh nào khác không
            still_used = await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM public.streetview_images "
                "WHERE image_url = $1)",
                row["image_url"],
            )
            if not still_used:
                file_to_remove = _file_path_from_url(row["image_url"])

    # Xóa file vật lý sau khi transaction commit thành công
    if file_to_remove is not None:
        await asyncio.to_thread(_unlink, file_to_remove)

    return Response(status_code=204)