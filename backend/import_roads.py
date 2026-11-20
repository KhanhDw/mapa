
import sys
import os
from pathlib import Path

import geopandas as gpd
from sqlalchemy import create_engine, text
from geoalchemy2 import Geometry

DB_URL = os.environ["DATABASE_URL"]
engine = create_engine(DB_URL)
# UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# =====================================
# 1. DATABASE CONFIGURATION
# =====================================

DB_URL = os.environ["DATABASE_URL"]

engine = create_engine(DB_URL)

try:
    # =====================================
    # 2. GEOJSON PATH
    # =====================================

    BASE_DIR = Path(__file__).resolve().parent

    geojson_path = (
        BASE_DIR
        / "data"
        / "vietnam_roads.geojson"
    )

    if not geojson_path.exists():
        raise FileNotFoundError(
            f"Không tìm thấy file: {geojson_path}"
        )

    # =====================================
    # 3. READ GEOJSON
    # =====================================

    print("[*] Đang đọc GeoJSON...")

    gdf = gpd.read_file(geojson_path)

    print(f"[+] Tổng đối tượng: {len(gdf)}")
    print(f"[+] CRS: {gdf.crs}")

    if gdf.empty:
        raise ValueError("GeoJSON không có dữ liệu!")

    if gdf.crs is None:
        raise ValueError("Không xác định được CRS!")

    # =====================================
    # 4. STANDARDIZE DATA
    # =====================================

    print("[*] Chuẩn hóa geometry...")

    gdf = gdf.to_crs("EPSG:4326")

    # Ánh xạ fid thành id
    if "fid" not in gdf.columns:
        raise ValueError("GeoJSON thiếu trường fid!")

    for column in ["name", "fclass"]:
        if column not in gdf.columns:
            raise ValueError(
                f"GeoJSON thiếu trường {column}!"
            )

    gdf = gdf.rename(columns={"fid": "id"})

    # Chỉ nhận LineString và MultiLineString
    gdf = gdf[
        gdf.geometry.notna()
        & ~gdf.geometry.is_empty
    ].copy()

    gdf = gdf[
        gdf.geom_type.isin(
            ["LineString", "MultiLineString"]
        )
    ].copy()

    # Chuyển LineString thành MultiLineString
    from shapely.geometry import MultiLineString

    gdf.geometry = gdf.geometry.apply(
        lambda geom: (
            MultiLineString([geom])
            if geom.geom_type == "LineString"
            else geom
        )
    )

    # Giữ đúng cấu trúc bảng hiện tại
    gdf = gdf[["id", "name", "fclass", "geometry"]]

    gdf = gdf.rename_geometry("geom")

    print("[+] Geometry:")
    print(gdf.geom_type.value_counts())

    # Kiểm tra ID trùng trong file
    if gdf["id"].duplicated().any():
        raise ValueError("GeoJSON có fid trùng nhau!")

    # =====================================
    # 5. CHECK DATABASE
    # =====================================

    print("[*] Kiểm tra bảng PostGIS...")

    with engine.connect() as conn:

        table_exists = conn.execute(
            text("""
                SELECT to_regclass('public.vietnam_roads')
            """)
        ).scalar()

        if table_exists is None:
            raise RuntimeError(
                "Bảng public.vietnam_roads không tồn tại!"
            )

        existing_count = conn.execute(
            text("""
                SELECT COUNT(*)
                FROM public.vietnam_roads
            """)
        ).scalar()

        print(f"[+] Số bản ghi hiện tại: {existing_count}")

    if existing_count > 0:
        raise RuntimeError(
            "Bảng đã có dữ liệu. Dừng import để tránh trùng lặp."
        )

    # =====================================
    # 6. IMPORT
    # =====================================

    print("[*] Đang import vào PostGIS...")

    gdf.to_postgis(
        name="vietnam_roads",
        con=engine,
        schema="public",
        if_exists="append",
        index=False,
        chunksize=500,
        dtype={
            "geom": Geometry(
                geometry_type="MULTILINESTRING",
                srid=4326
            )
        }
    )

    # =====================================
    # 7. VERIFY
    # =====================================

    with engine.connect() as conn:

        result = conn.execute(
            text("""
                SELECT
                    COUNT(*) AS total,
                    COUNT(name) AS named,
                    COUNT(fclass) AS classified,
                    ST_SRID(geom) AS srid,
                    GeometryType(geom) AS geom_type
                FROM public.vietnam_roads
                GROUP BY ST_SRID(geom), GeometryType(geom)
            """)
        ).fetchall()

        print("[+] Kết quả:")

        for row in result:
            print(row)

    print("[+] IMPORT ROADS HOÀN TẤT!")

finally:
    engine.dispose()
