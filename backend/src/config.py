
"""
Toàn bộ config runtime đọc từ backend/.env.

Thêm config mới = thêm 1 field vào class Settings.
Không cần sửa os.getenv ở bất kỳ chỗ nào khác.

Các alias module-level ở cuối file giữ để tương thích
ngược với code cũ (import trực tiếp WRITE_API_KEY, PANORAMAS_DIR...).
"""

from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- Database ----
    DATABASE_URL: str = Field(
        default="",
        description="postgresql://user:pass@host:port/db",
    )
    DB_POOL_MIN: int = Field(default=2, ge=1)
    DB_POOL_MAX: int = Field(default=10, ge=1)

    # Timeout mặc định cho truy vấn database (giây)
    DB_COMMAND_TIMEOUT: int = Field(default=15, ge=1)

    # Timeout riêng cho truy vấn tile (giây)
    # Code thực thi truy vấn tile cần chủ động sử dụng cấu hình này.
    DB_TILE_COMMAND_TIMEOUT: int = Field(default=30, ge=1)

    # ---- Đường dẫn media ----
    PANORAMAS_DIR: Path = BACKEND_DIR / "data" / "panoramas"
    USER_MEDIA_DIR: Path = BACKEND_DIR / "data" / "user_media"

    # ---- CORS ----
    # "*" cho dev; prod đặt dạng:
    # ALLOWED_ORIGINS=https://a.com,https://b.com
    ALLOWED_ORIGINS: str = "*"

    # ---- Proxy tới tile servers nội bộ ----
    TILESERV_URL: str = "http://127.0.0.1:7800"
    VERSATILES_URL: str = "http://127.0.0.1:8080"
    PROXY_TIMEOUT_S: float = Field(default=30.0, gt=0)
    PROXY_CONNECT_TIMEOUT_S: float = Field(default=5.0, gt=0)

    # ---- Giới hạn upload / dữ liệu ----
    MAX_UPLOAD_MB: int = Field(default=30, ge=1)
    MAX_PHOTOS_PER_POI: int = Field(default=20, ge=1)
    MAX_IMAGE_PIXELS: int = Field(default=100_000_000, ge=1)
    PANO_MIN_WIDTH: int = Field(default=1024, ge=1)
    MAX_FEATURES: int = Field(default=5000, ge=1)
    MAX_BBOX_AREA_DEG2: float = Field(default=1.0, gt=0)

    # ---- Public endpoints ----
    # Số request tối đa trong một cửa sổ thời gian.
    # Đây là cấu hình; cần middleware hoặc dependency rate limit
    # sử dụng các giá trị này để thực sự giới hạn request.
    PUBLIC_RATE_LIMIT_REQUESTS: int = Field(default=30, ge=1)
    PUBLIC_RATE_LIMIT_WINDOW_SECONDS: int = Field(default=60, ge=1)

    # Giới hạn số bản ghi tối đa được tạo qua public endpoints.
    # Cần kiểm tra giới hạn này trong logic xử lý endpoint.
    PUBLIC_MAX_RECORDS: int = Field(default=1000, ge=1)

    # Giới hạn số bản ghi tối đa trong một request public.
    PUBLIC_MAX_RECORDS_PER_REQUEST: int = Field(default=20, ge=1)

    # ---- Bảo mật ----
    WRITE_API_KEY: str | None = None

    # ---- Runtime ----
    ENV: str = "dev"  # dev | prod

    # ---- Helpers ----
    @property
    def allowed_origins_list(self) -> list[str]:
        value = self.ALLOWED_ORIGINS.strip()

        if value == "*":
            return ["*"]

        return [
            origin.strip()
            for origin in value.split(",")
            if origin.strip()
        ]

    @property
    def is_dev(self) -> bool:
        return self.ENV.strip().lower() in {
            "dev",
            "development",
            "local",
        }

    @property
    def is_prod(self) -> bool:
        return self.ENV.strip().lower() in {
            "prod",
            "production",
        }

    @model_validator(mode="after")
    def validate_production_settings(self):
        if not self.is_prod:
            return self

        errors = []

        if not self.WRITE_API_KEY or not self.WRITE_API_KEY.strip():
            errors.append("WRITE_API_KEY chưa được cấu hình")

        if not self.DATABASE_URL or not self.DATABASE_URL.strip():
            errors.append("DATABASE_URL chưa được cấu hình")

        origins = self.ALLOWED_ORIGINS.strip()

        if origins == "*":
            errors.append(
                'ALLOWED_ORIGINS không được là "*" trong production'
            )
        elif not self.allowed_origins_list:
            errors.append(
                "ALLOWED_ORIGINS phải có ít nhất một origin hợp lệ"
            )

        if self.DB_POOL_MIN > self.DB_POOL_MAX:
            errors.append(
                "DB_POOL_MIN không được lớn hơn DB_POOL_MAX"
            )

        if errors:
            raise ValueError(
                "Cấu hình production không hợp lệ:\n- "
                + "\n- ".join(errors)
            )

        return self

    def ensure_dirs(self) -> None:
        self.PANORAMAS_DIR.mkdir(parents=True, exist_ok=True)
        self.USER_MEDIA_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()


# ----- Re-export cho code cũ / tương thích ngược -----
# Code mới nên dùng settings.X.
# Các alias giữ để file cũ không phải sửa.

DATABASE_URL = settings.DATABASE_URL
PANORAMAS_DIR = settings.PANORAMAS_DIR
USER_MEDIA_DIR = settings.USER_MEDIA_DIR
MAX_FEATURES = settings.MAX_FEATURES
MAX_UPLOAD_MB = settings.MAX_UPLOAD_MB
PANO_MIN_WIDTH = settings.PANO_MIN_WIDTH
WRITE_API_KEY = settings.WRITE_API_KEY
