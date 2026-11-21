# backend\src\routers\streetview.py
"""Endpoint street view: đọc (map), list quản lý, sửa, xóa ảnh panorama.

Đồng bộ schema DB v2 (Phương án A):
- Bảng public.streetview_images: id, file_path, heading, pitch, geom, created_at
- Loại bỏ next_ids, link_positions (không còn trong DB).
- Map file_path -> image_url (/panoramas/<file_path>) và created_at -> captured_at
  để giữ tương thích tối đa với FE.
"""
import asyncio
import logging
from datetime import datetime
from pathlib import Path
import re
import asyncpg
from fastapi import (APIRouter, Depends, File, Form,         
                     HTTPException, Path as PathParam, Query,
                     Response, UploadFile)                    
from pydantic import BaseModel, Field

from ..config import settings
from ..db import get_pool
from ..utils import validate_bbox
from .auth import get_current_user


ALLOWED_PANO_EXTS      = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PANO_UPLOAD_BYTES  = 50 * 1024 * 1024          # 50 MB / ảnh
_STEM_SAFE_RE          = re.compile(r"[^A-Za-z0-9._-]+")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/streetview", tags=["streetview"])

INT4_MAX = 2**31 - 1
PANORAMA_URL_PREFIX = "/panoramas/"

_COLS = """
    id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
    file_path, heading, pitch
"""
_COLS_DETAIL = _COLS + ", created_at"


# ---------- helpers ----------
def _to_image_url(file_path: str | None) -> str | None:
    if not file_path:
        return None
    if file_path.startswith("/"):
        return file_path
    return f"{PANORAMA_URL_PREFIX}{file_path.lstrip('/')}"


def _to_feature(row) -> dict:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [float(row["lng"]), float(row["lat"])]},
        "properties": {
            "id": int(row["id"]),
            "file_path": row["file_path"],
            "image_url": _to_image_url(row["file_path"]),
            "heading": float(row["heading"] or 0.0),
            "pitch": float(row["pitch"] or 0.0),
        },
    }


def _to_detail(row) -> dict:
    created_iso = row["created_at"].isoformat() if row.get("created_at") else None
    d = {
        "id": int(row["id"]),
        "lng": float(row["lng"]),
        "lat": float(row["lat"]),
        "file_path": row["file_path"],
        "image_url": _to_image_url(row["file_path"]),
        "heading": float(row["heading"] or 0.0),
        "pitch": float(row["pitch"] or 0.0),
        "created_at": created_iso,
        "captured_at": created_iso,  # alias tương thích ngược với FE cũ
    }
    if "distance_meters" in row:
        d["distance_meters"] = round(float(row["distance_meters"]), 2)
    return d


def _resolve_pano_file(file_path: str | None) -> Path | None:
    if not file_path:
        return None
    name = file_path
    if name.startswith(PANORAMA_URL_PREFIX):
        name = name[len(PANORAMA_URL_PREFIX):]
    name = name.lstrip("/")
    if not name or ".." in name:
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

def _sanitize_stem(name: str) -> str:
    """Bỏ mọi path component, ký tự lạ; trả stem tối đa 100 ký tự ASCII."""
    name = Path(name).name                       # chống ../../
    name = name.replace("\\", "_").replace("/", "_")
    name = _STEM_SAFE_RE.sub("_", name).strip("._-")
    return name[:100]


def _sanitize_subdir(subdir: str | None) -> str:
    """Chuẩn hoá subdir (tối đa 3 cấp, mỗi cấp 50 ký tự); rỗng nếu không hợp lệ."""
    if not subdir:
        return ""
    parts = [p for p in Path(subdir).parts if p not in ("", ".", "..")]
    cleaned: list[str] = []
    for p in parts[:3]:
        s = _STEM_SAFE_RE.sub("_", p).strip("._-")
        if s:
            cleaned.append(s[:50])
    return "/".join(cleaned)


async def _allocate_unique_path(
    pool: asyncpg.Pool, target_dir: Path, base: Path, stem: str, ext: str,
    max_tries: int = 50,
) -> Path:
    """Tìm Path vừa chưa có trên đĩa vừa chưa có trong DB."""
    for i in range(max_tries):
        name      = f"{stem}{ext}" if i == 0 else f"{stem}_{i}{ext}"
        candidate = target_dir / name
        if candidate.exists():
            continue
        rel = candidate.relative_to(base).as_posix()
        exists = await pool.fetchval(
            "SELECT EXISTS (SELECT 1 FROM public.streetview_images "
            "WHERE file_path = $1)",
            rel,
        )
        if not exists:
            return candidate
    raise HTTPException(409, "Không tìm được tên file trống (quá nhiều trùng lặp)")


async def _save_upload(upload: UploadFile, dest: Path) -> int:
    """Ghi file atomic (.part → rename), trả size_bytes. Raise 413 nếu quá lớn."""
    tmp  = dest.with_name(dest.name + ".part")
    size = 0
    try:
        with tmp.open("wb") as fh:
            while True:
                chunk = await upload.read(1024 * 1024)       # 1 MB / lần
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_PANO_UPLOAD_BYTES:
                    raise HTTPException(
                        413,
                        f"File vượt quá {MAX_PANO_UPLOAD_BYTES // (1024 * 1024)} MB",
                    )
                await asyncio.to_thread(fh.write, chunk)
        await asyncio.to_thread(tmp.replace, dest)
    except Exception:
        await asyncio.to_thread(lambda: tmp.unlink(missing_ok=True))
        raise
    return size


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
        path_cond = f"file_path ILIKE ${len(args)} ESCAPE '\'"
        if q.isascii() and q.isdigit() and int(q) <= INT4_MAX:
            args.append(int(q))
            where = f" WHERE id = ${len(args)} OR {path_cond}"
        else:
            where = f" WHERE {path_cond}"

    async with pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT count(*) FROM public.streetview_images" + where, *args
        )
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
               ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
        FROM public.streetview_images
        WHERE geom && ST_Expand(ST_SetSRID(ST_MakePoint($1, $2), 4326), $3 / 60000.0)
          AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
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
    pitch: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    lat: float | None = Field(default=None, ge=-90, le=90)
    created_at: datetime | None = None
    captured_at: datetime | None = None


class BatchUpdateInput(BaseModel):
    ids: list[int] = Field(..., min_length=1)
    delta_lng: float | None = None
    delta_lat: float | None = None
    created_at: datetime | None = None
    captured_at: datetime | None = None


@router.put("/image/{image_id}")
async def update_streetview_image(
    body: StreetViewUpdate,
    image_id: int = PathParam(ge=1, le=INT4_MAX),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    sent = body.model_fields_set
    sets: list[str] = []
    args: list = [image_id]

    if "heading" in sent and body.heading is not None:
        args.append(body.heading)
        sets.append(f"heading = ${len(args)}")

    if "pitch" in sent and body.pitch is not None:
        args.append(body.pitch)
        sets.append(f"pitch = ${len(args)}")

    has_lng = "lng" in sent and body.lng is not None
    has_lat = "lat" in sent and body.lat is not None

    if has_lng and has_lat:
        args.extend([body.lng, body.lat])
        sets.append(
            f"geom = ST_SetSRID(ST_MakePoint(${len(args) - 1}::float8, "
            f"${len(args)}::float8), 4326)"
        )
    elif has_lng or has_lat or "lng" in sent or "lat" in sent:
        raise HTTPException(
            400,
            "Cần cung cấp cả lng và lat nếu muốn đổi vị trí",
        )

    ts = (
        body.created_at
        if "created_at" in sent
        else body.captured_at if "captured_at" in sent else None
    )

    if ts is not None:
        args.append(ts)
        sets.append(f"created_at = ${len(args)}")

    if not sets:
        raise HTTPException(400, "Không có trường nào để cập nhật")

    async with pool.acquire() as conn:
        async with conn.transaction():
            owner = await conn.fetchrow(
                """
                SELECT user_id
                FROM public.streetview_images
                WHERE id = $1
                FOR UPDATE
                """,
                image_id,
            )

            if owner is None:
                raise HTTPException(404, "Ảnh không tồn tại")

            _ensure_image_access(owner, current_user)

            row = await conn.fetchrow(
                f"""
                UPDATE public.streetview_images
                SET {', '.join(sets)}
                WHERE id = $1
                RETURNING {_COLS_DETAIL}
                """,
                *args,
            )

    return _to_detail(row)


@router.patch("/batch-update")
async def batch_update_streetview(
    body: BatchUpdateInput,
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Cập nhật hàng loạt tọa độ hoặc thời gian tạo cho nhiều ảnh."""
    ts = body.created_at or body.captured_at

    if (
        body.delta_lng is None
        and body.delta_lat is None
        and ts is None
    ):
        raise HTTPException(400, "Không có trường nào để cập nhật")

    # Loại ID trùng để tránh cập nhật/đếm lặp.
    image_ids = list(dict.fromkeys(body.ids))

    async with pool.acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """
                SELECT id, user_id
                FROM public.streetview_images
                WHERE id = ANY($1::int[])
                ORDER BY id
                FOR UPDATE
                """,
                image_ids,
            )

            if len(rows) != len(image_ids):
                raise HTTPException(
                    404,
                    "Một hoặc nhiều ảnh không tồn tại",
                )

            for row in rows:
                _ensure_image_access(row, current_user)

            if body.delta_lng is not None or body.delta_lat is not None:
                dlng = body.delta_lng or 0.0
                dlat = body.delta_lat or 0.0

                await conn.execute(
                    """
                    UPDATE public.streetview_images
                    SET geom = ST_SetSRID(
                        ST_MakePoint(
                            ST_X(geom) + $1,
                            ST_Y(geom) + $2
                        ),
                        4326
                    )
                    WHERE id = ANY($3::int[])
                    """,
                    dlng,
                    dlat,
                    image_ids,
                )

            if ts is not None:
                await conn.execute(
                    """
                    UPDATE public.streetview_images
                    SET created_at = $1
                    WHERE id = ANY($2::int[])
                    """,
                    ts,
                    image_ids,
                )

    return {"updated_count": len(image_ids)}

@router.delete("/image/{image_id}", status_code=204)
async def delete_streetview_image(
    image_id: int = PathParam(ge=1, le=INT4_MAX),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    file_to_remove: Path | None = None

    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT user_id, file_path
                FROM public.streetview_images
                WHERE id = $1
                FOR UPDATE
                """,
                image_id,
            )

            if row is None:
                raise HTTPException(404, "Ảnh không tồn tại")

            _ensure_image_access(row, current_user)

            await conn.execute(
                """
                DELETE FROM public.streetview_images
                WHERE id = $1
                """,
                image_id,
            )

            still_used = await conn.fetchval(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM public.streetview_images
                    WHERE file_path = $1
                )
                """,
                row["file_path"],
            )

            if not still_used:
                file_to_remove = _resolve_pano_file(row["file_path"])

    # Chỉ xóa file sau khi transaction commit thành công.
    if file_to_remove is not None:
        await asyncio.to_thread(_unlink, file_to_remove)

    return Response(status_code=204)


@router.post(
    "/upload",
    status_code=201
)
async def upload_streetview_image(
    file: UploadFile = File(..., description="Ảnh panorama (jpg/jpeg/png/webp)"),
    lng: float = Form(..., ge=-180, le=180),
    lat: float = Form(..., ge=-90, le=90),
    heading: float = Form(0.0, ge=0, lt=360),
    pitch: float = Form(0.0, ge=-90, le=90),
    filename: str | None = Form(
        None, max_length=200,
        description="Tên file tuỳ chọn (chỉ lấy stem, KHÔNG cần ext)",
    ),
    subdir: str | None = Form(
        None, max_length=100,
        description="Thư mục con dưới PANORAMAS_DIR (vd. '2025/01')",
    ),
    captured_at: datetime | None = Form(
        None, description="Thời điểm chụp (ISO 8601). Mặc định = now()",
    ),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Upload 1 ảnh panorama: ghi file vào PANORAMAS_DIR + thêm bản ghi DB."""
    # ----- 1. Validate định dạng -----
    original_name = file.filename or ""
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_PANO_EXTS:
        raise HTTPException(
            415,
            f"Định dạng không hỗ trợ: {ext or '(không có ext)'}. "
            f"Chỉ chấp nhận: {', '.join(sorted(ALLOWED_PANO_EXTS))}",
        )
    if file.content_type and not (
        file.content_type.startswith("image/")
        or file.content_type == "application/octet-stream"
    ):
        raise HTTPException(415, f"Content-Type không phải ảnh: {file.content_type}")

    # ----- 2. Thư mục đích (chống traversal) -----
    base        = settings.PANORAMAS_DIR.resolve()
    safe_subdir = _sanitize_subdir(subdir)
    target_dir  = (base / safe_subdir).resolve()
    if not target_dir.is_relative_to(base):
        raise HTTPException(400, "subdir không hợp lệ")

    # ----- 3. Đặt tên + tạo thư mục -----
    raw_stem = Path(filename).stem if filename else Path(original_name).stem
    stem     = _sanitize_stem(raw_stem) or "pano"

    try:
        await asyncio.to_thread(target_dir.mkdir, parents=True, exist_ok=True)
        dest = await _allocate_unique_path(pool, target_dir, base, stem, ext)
    except OSError as e:
        logger.exception("Không tạo được thư mục/file đích")
        raise HTTPException(500, "Không tạo được thư mục lưu ảnh") from e

    # ----- 4. Ghi file (rollback nếu DB lỗi) -----
    size      = await _save_upload(file, dest)
    file_path = dest.relative_to(base).as_posix()

        # ----- 5. Insert DB -----
    try:
        row = await pool.fetchrow(
            f"""
            INSERT INTO public.streetview_images
                (user_id, file_path, heading, pitch, geom, created_at)
            VALUES (
                $1, $2, $3, $4,
                ST_SetSRID(
                    ST_MakePoint($5::float8, $6::float8),
                    4326
                ),
                COALESCE($7::timestamptz, now())
            )
            RETURNING {_COLS_DETAIL}
            """,
            current_user["id"],
            file_path,
            heading,
            pitch,
            lng,
            lat,
            captured_at,
        )
    except Exception as e:
        await asyncio.to_thread(dest.unlink, missing_ok=True)
        logger.exception(
            "Insert streetview_images thất bại, đã xoá file %s",
            dest,
        )
        raise HTTPException(500, "Lỗi lưu DB") from e

    result = _to_detail(row)
    result["size_bytes"] = size
    return result


def _ensure_image_access(row: asyncpg.Record, current_user: dict) -> None:
    is_owner = row["user_id"] == current_user["id"]
    is_admin = current_user["role"] == "admin"

    if not is_owner and not is_admin:
        raise HTTPException(
            403,
            "Bạn không có quyền chỉnh sửa ảnh Street View này",
        )