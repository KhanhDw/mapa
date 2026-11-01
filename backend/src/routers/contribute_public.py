"""Public Contribute endpoints — FE dùng, KHÔNG cần X-API-Key.

Logic copy từ contribute.py nhưng bỏ auth. FE gọi qua Vite proxy:
    FE → /api/contribute/* → backend (route này) → DB + filesystem

Lý do: FE không nên mang X-API-Key (lộ trong browser).
"""
import asyncio
import logging
import uuid

import asyncpg
from fastapi import (APIRouter, Depends, File, Form, HTTPException,
                     Path as PathParam, UploadFile)

from ..config import settings
from ..db import get_pool
from .contribute import (
    UserPoiIn,
    _process_image,
    _read_limited,
    _remove_files,
    _write_files,
    _media_url,
    PANORAMAS_URL,
    BIGINT_MAX,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contribute", tags=["contribute-public"])


@router.post("/poi", status_code=201)
async def create_poi(body: UserPoiIn, pool: asyncpg.Pool = Depends(get_pool)):
    row = await pool.fetchrow(
        """
        INSERT INTO user_data.pois (name, category, address, phone, description, geom)
        VALUES ($1, $2, $3, $4, $5,
                ST_SetSRID(ST_MakePoint($6::float8, $7::float8), 4326))
        RETURNING id, created_at
        """,
        body.name, body.category, body.address, body.phone, body.description,
        body.lng, body.lat,
    )
    return {
        "id": int(row["id"]),
        "source": "user",
        **body.model_dump(),
        "created_at": row["created_at"].isoformat(),
        "photos": [],
    }


@router.post("/photos/{poi_id}", status_code=201)
async def upload_photo(
    poi_id: int = PathParam(ge=1, le=BIGINT_MAX),
    file: UploadFile = File(...),
    pool: asyncpg.Pool = Depends(get_pool),
):
    if not await pool.fetchval("SELECT 1 FROM user_data.pois WHERE id = $1", poi_id):
        raise HTTPException(404, "Không tìm thấy địa điểm")
    n = await pool.fetchval(
        "SELECT count(*) FROM user_data.poi_photos WHERE poi_id = $1", poi_id
    )
    if n >= settings.MAX_PHOTOS_PER_POI:
        raise HTTPException(
            409, f"Mỗi địa điểm tối đa {settings.MAX_PHOTOS_PER_POI} ảnh"
        )

    data = await _read_limited(file)
    try:
        main_b, thumb_b, w, h = await asyncio.to_thread(_process_image, data, "photo")
    except ValueError as e:
        raise HTTPException(400, str(e))

    name = uuid.uuid4().hex
    rel_main, rel_thumb = f"{poi_id}/{name}.jpg", f"{poi_id}/{name}_t.jpg"
    base = settings.USER_MEDIA_DIR
    await asyncio.to_thread(
        _write_files, {base / rel_main: main_b, base / rel_thumb: thumb_b}
    )
    try:
        pid = await pool.fetchval(
            """INSERT INTO user_data.poi_photos (poi_id, file_path, thumb_path, width, height)
               VALUES ($1, $2, $3, $4, $5) RETURNING id""",
            poi_id, rel_main, rel_thumb, w, h,
        )
    except Exception:
        await asyncio.to_thread(_remove_files, [base / rel_main, base / rel_thumb])
        raise
    return {
        "id": int(pid), "url": _media_url(rel_main),
        "thumb_url": _media_url(rel_thumb), "width": w, "height": h,
    }


@router.post("/panorama", status_code=201)
async def upload_panorama(
    lng: float = Form(..., ge=-180, le=180),
    lat: float = Form(..., ge=-90, le=90),
    heading: float | None = Form(None, ge=0, lt=360),
    file: UploadFile = File(...),
    pool: asyncpg.Pool = Depends(get_pool),
):
    data = await _read_limited(file)
    try:
        main_b, _, w, h = await asyncio.to_thread(_process_image, data, "pano")
    except ValueError as e:
        raise HTTPException(400, str(e))

    filename = f"u_{uuid.uuid4().hex}.jpg"
    path = settings.PANORAMAS_DIR / filename
    image_url = f"{PANORAMAS_URL}/{filename}"
    await asyncio.to_thread(_write_files, {path: main_b})
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO public.streetview_images
                (geom, image_url, heading, captured_at, next_ids, link_positions)
            VALUES (ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326),
                    $3, $4, now(), ARRAY[]::integer[], '[]'::jsonb)
            RETURNING id, captured_at
            """,
            lng, lat, image_url, heading,
        )
    except Exception:
        await asyncio.to_thread(_remove_files, [path])
        raise
    return {
        "id": int(row["id"]),
        "image_url": image_url,
        "lng": lng, "lat": lat,
        "heading": heading,
        "width": w, "height": h,
        "captured_at": row["captured_at"].isoformat(),
    }