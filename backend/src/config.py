import os
from pathlib import Path
from dotenv import load_dotenv

# Thư mục backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Đọc backend/.env
load_dotenv(BACKEND_DIR / ".env")

# Cấu hình database
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        f"DATABASE_URL environment variable is required. "
        f"Please check: {BACKEND_DIR / '.env'}"
    )

# Thư mục lưu ảnh panorama
PANORAMAS_DIR = Path(
    os.getenv("PANORAMAS_DIR", str(BACKEND_DIR / "data" / "panoramas"))
).resolve()

# Thư mục lưu ảnh POI do người dùng thêm
USER_MEDIA_DIR = Path(
    os.getenv("USER_MEDIA_DIR", str(BACKEND_DIR / "data" / "user_media"))
).resolve()

# Giới hạn và cấu hình upload
MAX_FEATURES = 5000
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "30"))
PANO_MIN_WIDTH = int(os.getenv("PANO_MIN_WIDTH", "1024"))

# Khóa API dùng cho endpoint ghi dữ liệu
WRITE_API_KEY = os.getenv("WRITE_API_KEY")