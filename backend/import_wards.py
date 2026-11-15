
import sys
from pathlib import Path

import geopandas as gpd
from sqlalchemy import create_engine, text
from geoalchemy2 import Geometry

# Hỗ trợ tiếng Việt trên Windows
# Cấu hình UTF-8 cho terminal nếu Python hỗ trợ
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
    
# =====================================
# 1. DATABASE CONFIGURATION
# =====================================

DB_URL = (
    "postgresql+psycopg2://"
    "postgres:doi_mat_khau_manh@localhost:5432/webmap_db"
)

engine = create_engine(DB_URL)

# =====================================
# 2. GEOJSON FILE PATH
# =====================================

BASE_DIR = Path(__file__).resolve().parent

geojson_path = (
    BASE_DIR
    / "data"
    / "2025"
    / "drive-download-20261114T022545Z-1-001"
    / "VietnamWardBoundary2025.geojson"
)

if not geojson_path.exists():
    raise FileNotFoundError(
        f"Không tìm thấy file GeoJSON: {geojson_path}"
    )

# =====================================
# 3. READ GEOJSON
# =====================================

print("[*] Đang đọc file GeoJSON...")

gdf = gpd.read_file(geojson_path)

print(f"[+] Số lượng bản ghi: {len(gdf)}")
print(f"[+] CRS ban đầu: {gdf.crs}")

if gdf.empty:
    raise ValueError("File GeoJSON không có dữ liệu!")

if gdf.crs is None:
    raise ValueError("GeoJSON chưa xác định hệ tọa độ!")

# =====================================
# 4. STANDARDIZE GEOMETRY
# =====================================

print("[*] Chuẩn hóa hệ tọa độ...")

gdf = gdf.to_crs("EPSG:4326")

# Đổi tên geometry thành geom
gdf = gdf.rename_geometry("geom")

# Loại bỏ geometry rỗng hoặc null
gdf = gdf[
    gdf.geometry.notna() & ~gdf.geometry.is_empty
].copy()

# Kiểm tra geometry
print("[+] Geometry types:")
print(gdf.geom_type.value_counts())

# =====================================
# 5. CREATE POSTGIS SCHEMA
# =====================================

print("[*] Kiểm tra PostGIS và schema...")

with engine.begin() as conn:
    conn.execute(
        text("CREATE EXTENSION IF NOT EXISTS postgis")
    )

    conn.execute(
        text("CREATE SCHEMA IF NOT EXISTS user_data")
    )

# =====================================
# 6. IMPORT TO POSTGRESQL
# =====================================

print("[*] Đang import vào PostgreSQL/PostGIS...")

gdf.to_postgis(
    name="vietnam_wards_2025",
    con=engine,
    schema="user_data",
    if_exists="replace",
    index=False,
    chunksize=500,
    dtype={
        "geom": Geometry(
            geometry_type="MULTIPOLYGON",
            srid=4326
        )
    }
)

# =====================================
# 7. VERIFY DATA
# =====================================

with engine.connect() as conn:

    count = conn.execute(
        text("""
            SELECT COUNT(*)
            FROM user_data.vietnam_wards_2025
        """)
    ).scalar()

    print(f"[+] Tổng số xã/phường: {count}")

    geometry_info = conn.execute(
        text("""
            SELECT
                GeometryType(geom),
                ST_SRID(geom),
                COUNT(*)
            FROM user_data.vietnam_wards_2025
            GROUP BY GeometryType(geom), ST_SRID(geom)
        """)
    ).fetchall()

    print("[+] Kiểm tra geometry:")

    for row in geometry_info:
        print(row)

# =====================================
# 8. FINISH
# =====================================

engine.dispose()

print("[+] IMPORT HOÀN TẤT!")
