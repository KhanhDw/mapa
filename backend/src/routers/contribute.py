"""Thêm dữ liệu người dùng: POI (tên, loại, địa chỉ...), ảnh phẳng, ảnh 360°.

- POI + ảnh phẳng  -> schema user_data (không bị tile server công bố, không bị nạp lại đè)
- Ảnh 360°         -> public.streetview_images (next_ids rỗng), nên lớp Street View,
                      /api/streetview/* và point_info dùng được ngay, không cần sửa gì thêm.
"""
import asyncio
import io
import secrets
import uuid
from pathlib import Path

import asyncpg
from fastapi import (APIRouter, Depends, File, Form, Header, HTTPException,
                     Path as PathParam, UploadFile)
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, field_validator

from ..config import (MAX_UPLOAD_MB, PANO_MIN_WIDTH, PANORAMAS_DIR,
                      USER_MEDIA_DIR, WRITE_API_KEY)
from ..db import get_pool

router = APIRouter(prefix="/api", tags=["contribute"])

USER_MEDIA_URL = "/user-media"
PANORAMAS_URL = "/panoramas"
MAX_PHOTOS_PER_POI = 20

Image.MAX_IMAGE_PIXELS = 100_000_000          # chặn decompression bomb
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
BIGINT_MAX = 2**63 - 1


def require_write_key(x_api_key: str | None = Header(default=None)):
    if not WRITE_API_KEY:
        raise HTTPException(503, "Chưa cấu hình WRITE_API_KEY trong .env")
    if not x_api_key or not secrets.compare_digest(x_api_key, WRITE_API_KEY):
        raise HTTPException(401, "Sai hoặc thiếu API key")


class UserPoiIn(BaseModel):
    lng: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(default="other", pattern=r"^[a-z0-9_]{1,50}$")
    address: str | None = Field(default=None, max_length=300)
    phone: str | None = Field(default=None, max_length=30)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Tên không được để trống")
        return v

    @field_validator("address", "phone", "description")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None


# ---------- xử lý ảnh (CPU nặng -> chạy trong thread) ----------
def _process_image(data: bytes, kind: str):
    """kind: 'photo' | 'pano'. Trả (main_jpeg, thumb_jpeg | None, width, height)."""
    try:
        probe = Image.open(io.BytesIO(data))
        if probe.format not in ALLOWED_FORMATS:
            raise ValueError("Chỉ chấp nhận JPEG, PNG hoặc WebP")
        probe.verify()
        img = Image.open(io.BytesIO(data))      # verify() làm hỏng đối tượng -> mở lại
        img.load()
    except ValueError:
        raise
    except Exception:
        raise ValueError("File ảnh không hợp lệ")

    if kind == "photo":
        img = ImageOps.exif_transpose(img)
        img.thumbnail((1920, 1920))
    else:
        if abs(img.width / img.height - 2) > 0.05:
            raise ValueError("Ảnh 360° (equirectangular) phải có tỉ lệ 2:1")
        if img.width < PANO_MIN_WIDTH:
            raise ValueError(f"Ảnh 360° quá nhỏ (tối thiểu rộng {PANO_MIN_WIDTH}px)")

    img = img.convert("RGB")
    main = io.BytesIO()
    img.save(main, "JPEG", quality=88 if kind == "photo" else 90, optimize=True)

    thumb_bytes = None
    if kind == "photo":
        t = img.copy()
        t.thumbnail((480, 480))
        tb = io.BytesIO()
        t.save(tb, "JPEG", quality=80)
        thumb_bytes = tb.getvalue()
    return main.getvalue(), thumb_bytes, img.width, img.height


async def _read_limited(file: UploadFile) -> bytes:
    limit = MAX_UPLOAD_MB * 1024 * 1024
    buf = bytearray()
    while chunk := await file.read(1024 * 1024):
        buf.extend(chunk)
        if len(buf) > limit:
            raise HTTPException(413, f"File vượt quá {MAX_UPLOAD_MB}MB")
    return bytes(buf)


def _write_files(files: dict[Path, bytes]) -> None:
    for path, content in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def _remove_files(paths) -> None:
    for p in paths:
        p.unlink(missing_ok=True)


def _media_url(rel: str | None) -> str | None:
    return f"{USER_MEDIA_URL}/{rel}" if rel else None


# ---------- endpoints ----------
@router.post("/user-pois", status_code=201, dependencies=[Depends(require_write_key)])
async def create_user_poi(body: UserPoiIn, pool: asyncpg.Pool = Depends(get_pool)):
    new_id = await pool.fetchval(
        """
        INSERT INTO user_data.pois (name, category, address, phone, description, geom)
        VALUES ($1, $2, $3, $4, $5,
                ST_SetSRID(ST_MakePoint($6::float8, $7::float8), 4326))
        RETURNING id
        """,
        body.name, body.category, body.address, body.phone, body.description,
        body.lng, body.lat,
    )
    return {"id": int(new_id), "source": "user", **body.model_dump(), "photos": []}


@router.get("/user-pois/{poi_id}")
async def get_user_poi(
    poi_id: int = PathParam(ge=1, le=BIGINT_MAX),
    pool: asyncpg.Pool = Depends(get_pool),
):
    p = await pool.fetchrow(
        """SELECT id, name, category, address, phone, description,
                  ST_X(geom) AS lng, ST_Y(geom) AS lat, created_at
           FROM user_data.pois WHERE id = $1""",
        poi_id,
    )
    if not p:
        raise HTTPException(404, "Không tìm thấy địa điểm")
    photos = await pool.fetch(
        """SELECT id, file_path, thumb_path, width, height
           FROM user_data.poi_photos WHERE poi_id = $1 ORDER BY id""",
        poi_id,
    )
    return {
        "id": int(p["id"]), "source": "user",
        "name": p["name"], "category": p["category"],
        "address": p["address"], "phone": p["phone"], "description": p["description"],
        "lng": p["lng"], "lat": p["lat"],
        "created_at": p["created_at"].isoformat(),
        "photos": [{
            "id": int(m["id"]),
            "url": _media_url(m["file_path"]),
            "thumb_url": _media_url(m["thumb_path"]),
            "width": m["width"], "height": m["height"],
        } for m in photos],
    }


@router.post("/user-pois/{poi_id}/photos", status_code=201,
             dependencies=[Depends(require_write_key)])
async def upload_poi_photo(
    poi_id: int = PathParam(ge=1, le=BIGINT_MAX),
    file: UploadFile = File(...),
    pool: asyncpg.Pool = Depends(get_pool),
):
    if not await pool.fetchval("SELECT 1 FROM user_data.pois WHERE id = $1", poi_id):
        raise HTTPException(404, "Không tìm thấy địa điểm")
    n = await pool.fetchval("SELECT count(*) FROM user_data.poi_photos WHERE poi_id = $1", poi_id)
    if n >= MAX_PHOTOS_PER_POI:
        raise HTTPException(409, f"Mỗi địa điểm tối đa {MAX_PHOTOS_PER_POI} ảnh")

    data = await _read_limited(file)
    try:
        main_b, thumb_b, w, h = await asyncio.to_thread(_process_image, data, "photo")
    except ValueError as e:
        raise HTTPException(400, str(e))

    name = uuid.uuid4().hex
    rel_main, rel_thumb = f"{poi_id}/{name}.jpg", f"{poi_id}/{name}_t.jpg"
    base = Path(USER_MEDIA_DIR)
    await asyncio.to_thread(_write_files, {base / rel_main: main_b, base / rel_thumb: thumb_b})
    try:
        pid = await pool.fetchval(
            """INSERT INTO user_data.poi_photos (poi_id, file_path, thumb_path, width, height)
               VALUES ($1, $2, $3, $4, $5) RETURNING id""",
            poi_id, rel_main, rel_thumb, w, h,
        )
    except Exception:
        await asyncio.to_thread(_remove_files, [base / rel_main, base / rel_thumb])
        raise
    return {"id": int(pid), "url": _media_url(rel_main),
            "thumb_url": _media_url(rel_thumb), "width": w, "height": h}


@router.post("/user-panoramas", status_code=201, dependencies=[Depends(require_write_key)])
async def upload_user_panorama(
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

    filename = f"u_{uuid.uuid4().hex}.jpg"          # tên do server tạo -> không có path traversal
    path = Path(PANORAMAS_DIR) / filename
    image_url = f"{PANORAMAS_URL}/{filename}"
    await asyncio.to_thread(_write_files, {path: main_b})
    try:
        new_id = await pool.fetchval(
            """
            INSERT INTO public.streetview_images
                (geom, image_url, heading, captured_at, next_ids, link_positions)
            VALUES (ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326),
                    $3, $4, now(), ARRAY[]::integer[], '[]'::jsonb)
            RETURNING id
            """,
            lng, lat, image_url, heading,
        )
    except Exception:
        await asyncio.to_thread(_remove_files, [path])
        raise
    return {"id": int(new_id), "image_url": image_url, "lng": lng, "lat": lat,
            "heading": heading, "width": w, "height": h}