"""Toàn bộ config runtime đọc từ backend/.env.

Thêm config mới = thêm 1 field vào class Settings. Không cần sửa os.getenv
ở bất kỳ chỗ nào khác. Các alias module-level ở cuối file giữ để tương thích
ngược với code cũ (import trực tiếp WRITE_API_KEY, PANORAMAS_DIR...).
"""
from pathlib import Path

from pydantic import Field
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
    DATABASE_URL: str = Field(..., description="postgresql://user:pass@host:port/db")
    DB_POOL_MIN: int = 2
    DB_POOL_MAX: int = 10
    DB_COMMAND_TIMEOUT: int = 10

    # ---- Đường dẫn media ----
    PANORAMAS_DIR: Path = BACKEND_DIR / "data" / "panoramas"
    USER_MEDIA_DIR: Path = BACKEND_DIR / "data" / "user_media"

    # ---- CORS ----
    # "*" cho dev; prod đặt dạng "https://a.com,https://b.com"
    ALLOWED_ORIGINS: str = "*"


    # ---- Proxy tới tile servers nội bộ ----
    TILESERV_URL: str = "http://127.0.0.1:7800"
    VERSATILES_URL: str = "http://127.0.0.1:8080"
    PROXY_TIMEOUT_S: float = 30.0
    PROXY_CONNECT_TIMEOUT_S: float = 5.0


    # ---- Giới hạn upload / dữ liệu ----
    MAX_UPLOAD_MB: int = 30
    MAX_PHOTOS_PER_POI: int = 20
    MAX_IMAGE_PIXELS: int = 100_000_000
    PANO_MIN_WIDTH: int = 1024
    MAX_FEATURES: int = 5000
    MAX_BBOX_AREA_DEG2: float = 1.0   # chặn query bbox quá lớn

    # ---- Bảo mật ----
    WRITE_API_KEY: str | None = None

    # ---- Runtime ----
    ENV: str = "dev"                   # dev | prod

    # ---- Helpers ----
    @property
    def allowed_origins_list(self) -> list[str]:
        s = self.ALLOWED_ORIGINS.strip()
        if s == "*":
            return ["*"]
        return [o.strip() for o in s.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.ENV.lower() in {"dev", "development", "local"}

    def ensure_dirs(self) -> None:
        self.PANORAMAS_DIR.mkdir(parents=True, exist_ok=True)
        self.USER_MEDIA_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()

# ----- Re-export cho code cũ / tương thích ngược -----
# Code mới nên dùng `settings.X`. Các alias giữ để file cũ không phải sửa.
DATABASE_URL = settings.DATABASE_URL
PANORAMAS_DIR = settings.PANORAMAS_DIR
USER_MEDIA_DIR = settings.USER_MEDIA_DIR
MAX_FEATURES = settings.MAX_FEATURES
MAX_UPLOAD_MB = settings.MAX_UPLOAD_MB
PANO_MIN_WIDTH = settings.PANO_MIN_WIDTH
WRITE_API_KEY = settings.WRITE_API_KEY