"""Thêm dữ liệu người dùng: POI, ảnh phẳng và ảnh 360°."""

import asyncio
import io
import logging
import uuid
from pathlib import Path
from typing import Iterable

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
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, field_validator

from ..config import settings
from ..db import get_pool
from .auth import get_current_user


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["contribute"])

USER_MEDIA_URL = "/user-media"
PANORAMAS_URL = "/panoramas"

BIGINT_MAX = 2**63 - 1

Image.MAX_IMAGE_PIXELS = settings.MAX_IMAGE_PIXELS

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


# ---------- SCHEMA ----------

class UserPoiIn(BaseModel):
    lng: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)

    name: str = Field(min_length=1, max_length=200)
    category: str = Field(
        default="other",
        pattern=r"^[a-z0-9_]{1,50}$",
    )

    address: str | None = Field(default=None, max_length=300)
    phone: str | None = Field(default=None, max_length=30)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Tên không được để trống")

        return value

    @field_validator("address", "phone", "description")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        value = (value or "").strip()
        return value or None


# ---------- IMAGE PROCESSING ----------

def _flatten_to_rgb(img: Image.Image) -> Image.Image:
    """
    Convert ảnh về RGB.

    Nếu ảnh có alpha, ghép trên nền trắng
    để tránh xuất hiện viền đen.
    """
    if img.mode in ("RGBA", "LA") or (
        img.mode == "P" and "transparency" in img.info
    ):
        img = img.convert("RGBA")

        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.getchannel("A"))

        return bg

    return img.convert("RGB")


def _process_image(
    data: bytes,
    kind: str,
) -> tuple[bytes, bytes | None, int, int]:
    """
    kind:
        photo: ảnh thông thường.
        pano: ảnh panorama 360°.

    Trả về:
        main_jpeg, thumb_jpeg, width, height.
    """

    if kind not in ("photo", "pano"):
        raise ValueError("Loại ảnh không hợp lệ")

    try:
        probe = Image.open(io.BytesIO(data))

        if probe.format not in ALLOWED_FORMATS:
            raise ValueError(
                "Chỉ chấp nhận JPEG, PNG hoặc WebP"
            )

        probe.verify()

        img = Image.open(io.BytesIO(data))
        img.load()

    except ValueError:
        raise

    except Exception as exc:
        logger.warning(
            "Không thể đọc file ảnh: %s",
            exc,
        )
        raise ValueError("File ảnh không hợp lệ") from exc

    if kind == "photo":
        img = ImageOps.exif_transpose(img)
        img.thumbnail((1920, 1920))

    else:
        # Panorama phải có tỷ lệ gần 2:1.
        if abs(img.width / img.height - 2) > 0.05:
            raise ValueError(
                "Ảnh 360° (equirectangular) phải có tỉ lệ 2:1"
            )

        # Kiểm tra chiều rộng tối thiểu.
        if img.width < settings.PANO_MIN_WIDTH:
            raise ValueError(
                f"Ảnh 360° quá nhỏ "
                f"(tối thiểu rộng {settings.PANO_MIN_WIDTH}px)"
            )

    img = _flatten_to_rgb(img)

    main = io.BytesIO()

    img.save(
        main,
        "JPEG",
        quality=88 if kind == "photo" else 90,
        optimize=True,
    )

    thumb_bytes = None

    if kind == "photo":
        thumb = img.copy()
        thumb.thumbnail((480, 480))

        thumb_buffer = io.BytesIO()

        thumb.save(
            thumb_buffer,
            "JPEG",
            quality=80,
        )

        thumb_bytes = thumb_buffer.getvalue()

    return (
        main.getvalue(),
        thumb_bytes,
        img.width,
        img.height,
    )


# ---------- FILE HANDLING ----------

async def _read_limited(file: UploadFile) -> bytes:
    """
    Đọc file theo từng chunk.

    Không cho phép upload vượt MAX_UPLOAD_MB.
    Luôn đóng UploadFile kể cả khi có lỗi.
    """

    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    buffer = bytearray()

    try:
        while chunk := await file.read(1024 * 1024):
            buffer.extend(chunk)

            if len(buffer) > limit:
                raise HTTPException(
                    413,
                    f"File vượt quá {settings.MAX_UPLOAD_MB}MB",
                )

    finally:
        await file.close()

    return bytes(buffer)


def _write_files(files: dict[Path, bytes]) -> None:
    """
    Ghi các file lên ổ đĩa.
    Tạo thư mục nếu chưa tồn tại.
    """

    for path, content in files.items():
        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        path.write_bytes(content)


def _remove_files(paths: Iterable[Path]) -> None:
    """
    Xóa file khi thao tác upload thất bại.

    Không để lỗi xóa file che mất lỗi database
    hoặc lỗi ghi file ban đầu.
    """

    for path in paths:
        try:
            path.unlink(missing_ok=True)

        except OSError:
            logger.exception(
                "Không thể xóa file tạm: %s",
                path,
            )


# ---------- URL HELPERS ----------

def _media_url(rel: str | None) -> str | None:
    if not rel:
        return None

    return f"{USER_MEDIA_URL}/{rel}"


def _pano_url(file_path: str | None) -> str | None:
    if not file_path:
        return None

    if file_path.startswith("/"):
        return file_path

    return f"{PANORAMAS_URL}/{file_path}"


# ---------- CREATE POI ----------

@router.post(
    "/user-pois",
    status_code=201,
)
async def create_user_poi(
    body: UserPoiIn,
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    row = await pool.fetchrow(
        """
        INSERT INTO user_data.pois
            (
                user_id,
                name,
                category,
                address,
                phone,
                description,
                geom
            )
        VALUES
            (
                $1, $2, $3, $4, $5, $6,
                ST_SetSRID(
                    ST_MakePoint($7::float8, $8::float8),
                    4326
                )
            )
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


# ---------- GET POI ----------

@router.get("/user-pois/{poi_id}")
async def get_user_poi(
    poi_id: int = PathParam(
        ge=1,
        le=BIGINT_MAX,
    ),
    pool: asyncpg.Pool = Depends(get_pool),
):
    p = await pool.fetchrow(
        """
        SELECT
            id,
            name,
            category,
            address,
            phone,
            description,
            ST_X(geom) AS lng,
            ST_Y(geom) AS lat,
            created_at
        FROM user_data.pois
        WHERE id = $1
        """,
        poi_id,
    )

    if p is None:
        raise HTTPException(
            404,
            "Không tìm thấy địa điểm",
        )

    photos = await pool.fetch(
        """
        SELECT
            id,
            file_path,
            thumb_path,
            created_at
        FROM user_data.poi_photos
        WHERE poi_id = $1
        ORDER BY id
        """,
        poi_id,
    )

    return {
        "id": int(p["id"]),
        "source": "user",
        "name": p["name"],
        "category": p["category"],
        "address": p["address"],
        "phone": p["phone"],
        "description": p["description"],
        "lng": float(p["lng"]),
        "lat": float(p["lat"]),
        "created_at": p["created_at"].isoformat(),
        "photos": [
            {
                "id": int(photo["id"]),
                "url": _media_url(photo["file_path"]),
                "thumb_url": _media_url(photo["thumb_path"]),
                "created_at": photo["created_at"].isoformat(),
            }
            for photo in photos
        ],
    }


# ---------- UPLOAD POI PHOTO ----------

@router.post(
    "/user-pois/{poi_id}/photos",
    status_code=201,
)
async def upload_poi_photo(
    poi_id: int = PathParam(
        ge=1,
        le=BIGINT_MAX,
    ),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    # Kiểm tra POI tồn tại + quyền sở hữu.
    poi = await pool.fetchrow(
        """
        SELECT id, user_id
        FROM user_data.pois
        WHERE id = $1
        """,
        poi_id,
    )

    if poi is None:
        raise HTTPException(
            404,
            "Không tìm thấy địa điểm",
        )

    is_owner = poi["user_id"] == current_user["id"]
    is_admin = current_user["role"] == "admin"

    if not is_owner and not is_admin:
        raise HTTPException(
            403,
            "Bạn không có quyền thêm ảnh cho địa điểm này",
        )

    # Giữ nguyên giới hạn ảnh trên mỗi POI.
    photo_count = await pool.fetchval(
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

    data = await _read_limited(file)

    try:
        main_bytes, thumb_bytes, width, height = await asyncio.to_thread(
            _process_image,
            data,
            "photo",
        )

    except ValueError as exc:
        raise HTTPException(
            400,
            str(exc),
        ) from exc

    name = uuid.uuid4().hex

    rel_main = f"{poi_id}/{name}.jpg"
    rel_thumb = f"{poi_id}/{name}_t.jpg"

    base = settings.USER_MEDIA_DIR

    main_path = base / rel_main
    thumb_path = base / rel_thumb

    try:
        # Ghi file.
        files_to_write: dict[Path, bytes] = {
            main_path: main_bytes,
        }

        if thumb_bytes is not None:
            files_to_write[thumb_path] = thumb_bytes

        await asyncio.to_thread(
            _write_files,
            files_to_write,
        )
        # Ghi database.
        row = await pool.fetchrow(
            """
            INSERT INTO user_data.poi_photos
                (poi_id, file_path, thumb_path)
            VALUES
                ($1, $2, $3)
            RETURNING id, created_at
            """,
            poi_id,
            rel_main,
            rel_thumb,
        )

    except Exception:
        # Dọn cả hai file nếu ghi file hoặc DB thất bại.
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


# ---------- UPLOAD USER PANORAMA ----------

@router.post(
    "/user-panoramas",
    status_code=201,
)
async def upload_user_panorama(
    lng: float = Form(..., ge=-180, le=180),
    lat: float = Form(..., ge=-90, le=90),
    heading: float = Form(0.0, ge=0, lt=360),
    pitch: float = Form(0.0, ge=-90, le=90),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
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
            filename,
            heading,
            pitch,
            lng,
            lat,
        )

    except Exception:
        # Xóa ảnh nếu thao tác upload thất bại.
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