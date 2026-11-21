"""Contribute endpoints — các thao tác ghi dữ liệu yêu cầu JWT Bearer.

Đồng bộ schema DB v2:
- user_data.poi_photos không có cột width, height
- public.streetview_images dùng file_path, heading, pitch, geom, created_at
"""

import asyncio
import logging
import uuid

import asyncpg
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Path as PathParam,
    UploadFile,
)

from ..config import settings
from ..db import get_pool
from .auth import get_current_user
from .contribute import (
    BIGINT_MAX,
    UserPoiIn,
    _media_url,
    _pano_url,
    _process_image,
    _read_limited,
    _remove_files,
    _write_files,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/contribute",
    tags=["contribute-public"],
)


# ---------- CREATE POI ----------

@router.post("/poi", status_code=201)
async def create_poi(
    body: UserPoiIn,
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    row = await pool.fetchrow(
        """
        INSERT INTO user_data.pois
            (user_id, name, category, address, phone, description, geom)
        VALUES
            ($1, $2, $3, $4, $5, $6,
             ST_SetSRID(
                 ST_MakePoint($7::float8, $8::float8),
                 4326
             ))
        RETURNING id, created_at
        """,
        current_user["id"],
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
        **body.model_dump(),
        "created_at": row["created_at"].isoformat(),
        "photos": [],
    }


# ---------- UPLOAD POI PHOTO ----------

@router.post("/photos/{poi_id}", status_code=201)
async def upload_photo(
    poi_id: int = PathParam(ge=1, le=BIGINT_MAX),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    # Khóa POI và xác minh quyền trước khi xử lý upload.
    async with pool.acquire() as conn:
        async with conn.transaction():
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
                raise HTTPException(404, "Không tìm thấy địa điểm")

            is_owner = poi["user_id"] == current_user["id"]
            is_admin = current_user["role"] == "admin"

            if not is_owner and not is_admin:
                raise HTTPException(
                    403,
                    "Bạn không có quyền thêm ảnh cho địa điểm này",
                )

            photo_count = await conn.fetchval(
                """
                SELECT count(*)
                FROM user_data.poi_photos
                WHERE poi_id = $1
                """,
                poi_id,
            )

            if photo_count >= settings.MAX_PHOTOS_PER_POI:
                raise HTTPException(
                    409,
                    f"Mỗi địa điểm tối đa {settings.MAX_PHOTOS_PER_POI} ảnh",
                )

    # Đọc file có giới hạn dung lượng.
    data = await _read_limited(file)

    try:
        main_bytes, thumb_bytes, width, height = await asyncio.to_thread(
            _process_image,
            data,
            "photo",
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    name = uuid.uuid4().hex

    rel_main = f"{poi_id}/{name}.jpg"
    rel_thumb = f"{poi_id}/{name}_t.jpg"

    base = settings.USER_MEDIA_DIR
    main_path = base / rel_main
    thumb_path = base / rel_thumb

    files_to_write: dict = {main_path: main_bytes}

    if thumb_bytes is not None:
        files_to_write[thumb_path] = thumb_bytes

    try:
        await asyncio.to_thread(_write_files, files_to_write)

        async with pool.acquire() as conn:
            async with conn.transaction():
                # Kiểm tra lại quyền trong transaction ghi DB.
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
                    raise HTTPException(404, "Không tìm thấy địa điểm")

                is_owner = poi["user_id"] == current_user["id"]
                is_admin = current_user["role"] == "admin"

                if not is_owner and not is_admin:
                    raise HTTPException(
                        403,
                        "Bạn không có quyền thêm ảnh cho địa điểm này",
                    )

                photo_count = await conn.fetchval(
                    """
                    SELECT count(*)
                    FROM user_data.poi_photos
                    WHERE poi_id = $1
                    """,
                    poi_id,
                )

                if photo_count >= settings.MAX_PHOTOS_PER_POI:
                    raise HTTPException(
                        409,
                        f"Mỗi địa điểm tối đa {settings.MAX_PHOTOS_PER_POI} ảnh",
                    )

                row = await conn.fetchrow(
                    """
                    INSERT INTO user_data.poi_photos
                        (poi_id, file_path, thumb_path)
                    VALUES ($1, $2, $3)
                    RETURNING id, created_at
                    """,
                    poi_id,
                    rel_main,
                    rel_thumb,
                )

    except Exception:
        await asyncio.to_thread(
            _remove_files,
            [main_path, thumb_path],
        )
        raise

    return {
        "id": int(row["id"]),
        "url": _media_url(rel_main),
        "thumb_url": _media_url(rel_thumb),
        "width": width,
        "height": height,
        "created_at": row["created_at"].isoformat(),
    }


# ---------- UPLOAD PANORAMA ----------

@router.post("/panorama", status_code=201)
async def upload_panorama(
    lng: float = Form(..., ge=-180, le=180),
    lat: float = Form(..., ge=-90, le=90),
    heading: float = Form(0.0, ge=0, lt=360),
    pitch: float = Form(0.0, ge=-90, le=90),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    # Đọc file có giới hạn dung lượng.
    data = await _read_limited(file)

    try:
        main_bytes, _, width, height = await asyncio.to_thread(
            _process_image,
            data,
            "pano",
        )

    except ValueError as exc:
        raise HTTPException(
            400,
            str(exc),
        ) from exc

    filename = f"u_{uuid.uuid4().hex}.jpg"

    path = settings.PANORAMAS_DIR / filename

    try:
        # Ghi ảnh panorama.
        await asyncio.to_thread(
            _write_files,
            {
                path: main_bytes,
            },
        )

        # Ghi database.
        row = await pool.fetchrow(
            """
            INSERT INTO public.streetview_images
                (user_id, file_path, heading, pitch, geom)
            VALUES
                ($1, $2, $3, $4,
                 ST_SetSRID(
                     ST_MakePoint($5::float8, $6::float8),
                     4326
                 ))
            RETURNING id, created_at
            """,
            current_user["id"],
            filename,
            heading,
            pitch,
            lng,
            lat,
        )

    except Exception:
        # Xóa ảnh nếu ghi file hoặc database thất bại.
        await asyncio.to_thread(
            _remove_files,
            [path],
        )

        raise

    return {
        "id": int(row["id"]),
        "file_path": filename,
        "image_url": _pano_url(filename),
        "lng": lng,
        "lat": lat,
        "heading": heading,
        "pitch": pitch,
        "width": width,
        "height": height,
        "created_at": row["created_at"].isoformat(),
    }