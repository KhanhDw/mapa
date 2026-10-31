"""Proxy tile requests tới pg_tileserv & versatiles.

Frontend chỉ gọi backend (cổng 8000). Backend chuyển tiếp tới dịch vụ nội bộ
(7800/8080). Nhờ đó:
  - Không expose thêm cổng ra ngoài.
  - Thêm cache header / auth / logging ở một chỗ.
  - Có thể thay backend tự sinh MVT sau này mà frontend không phải sửa URL.

Hai route proxy:
  GET/HEAD /tiles/{path}    → pg_tileserv:7800/{path}
  GET/HEAD /basemap/{path}  → versatiles:8080/tiles/{path}
                              (versatiles bắt buộc prefix /tiles/; proxy tự
                              thêm nếu client chưa có)

Một route MVT tự sinh (fallback khi không dùng pg_tileserv):
  GET /mvt/{table}/{z}/{x}/{y}.pbf

Bảo mật & đúng đắn:
  - Whitelist header forward, không passthrough bừa (tránh lộ server,
    x-powered-by, set-cookie từ upstream).
  - KHÔNG forward "content-encoding": httpx đã decode body; forward header
    gzip sẽ khiến client giải nén lần 2 → response hỏng.
  - Cache immutable CHỈ set khi upstream thực sự trả 200. Nếu set cho 404,
    client/CDN kẹt 1 ngày rất khó debug.
  - HEAD được route tới upstream đúng method, trả body rỗng (RFC 7231).
  - MVT endpoint dùng whitelist table + map cột theo từng bảng để tránh
    SQL injection và tránh crash khi schema khác nhau.
"""
import logging

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from ..config import settings
from ..db import get_pool

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tiles"])

_client: httpx.AsyncClient | None = None

# Header passthrough từ upstream về client.
# - KHÔNG có "content-encoding": httpx đã decode body, forward header gzip
#   sẽ làm client giải nén lần 2 → lỗi.
# - CÓ "content-range"/"accept-ranges" để Range request (PMTiles) hoạt động.
_KEEP_HEADERS = {
    "content-type",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
    "cache-control",
}

# Header client → upstream (conditional request + range).
_FORWARD_HEADERS = (
    "range",
    "if-none-match",
    "if-modified-since",
)

# ---- MVT: whitelist table + map cột theo bảng ----
# Mỗi bảng có schema khác nhau; hardcode "id, name, category" sẽ crash với
# vietnam_roads (dùng osm_id/fclass) và streetview_images (không có name).
_TABLE_COLUMNS = {
    "public.pois":              "id, name, category",
    "public.vietnam_roads":     "osm_id AS id, name, fclass AS category",
    "public.streetview_images": "id, NULL::text AS name, 'streetview'::text AS category",
}

# Cho phép client dùng tên ngắn thay vì qualified name.
_TABLE_ALIASES = {
    "pois":       "public.pois",
    "roads":      "public.vietnam_roads",
    "streetview": "public.streetview_images",
}

_MIN_ZOOM = 0
_MAX_ZOOM = 18

# Giới hạn feature / tile theo zoom. Zoom càng lớn phạm vi càng hẹp nên có
# thể chứa nhiều feature hơn mà không phình body. Base 2000 là điểm cân bằng
# giữa độ chi tiết và kích thước tile (~500 KB ở zoom 14).
def _feature_limit(z: int) -> int:
    return 2000 * (z + 1)

# Ngưỡng simplify theo zoom (đơn vị độ, ~ độ phân giải mức zoom).
# Công thức: 360 / (2^z * 4096) ≈ độ/phút-giây của 1 pixel ở zoom z.
def _simplify_tolerance(z: int) -> float:
    return 360.0 / (2 ** z * 4096)


async def init_client() -> None:
    global _client
    _client = httpx.AsyncClient(
        timeout=httpx.Timeout(
            settings.PROXY_TIMEOUT_S,
            connect=settings.PROXY_CONNECT_TIMEOUT_S,
        ),
        headers={"accept-encoding": "identity"},  # để GZip của FastAPI lo
        follow_redirects=False,
    )


async def close_client() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None


def _is_immutable_tile(path: str) -> bool:
    """z/x/y ở cuối path → nội dung bất biến, cache mạnh được.

    Hỗ trợ cả dạng có đuôi file: .../10/512/340.pbf
    """
    parts = [p for p in path.split("/") if p]
    if len(parts) < 3:
        return False
    z, x, y_raw = parts[-3], parts[-2], parts[-1]
    y = y_raw.rsplit(".", 1)[0]  # bỏ .pbf / .png / .jpg nếu có
    return z.isdigit() and x.isdigit() and y.isdigit()


async def _proxy(base: str, path: str, request: Request) -> Response:
    if _client is None:
        raise HTTPException(503, "tile proxy chưa sẵn sàng")

    url = f"{base.rstrip('/')}/{path.lstrip('/')}"
    fwd_headers = {"accept": request.headers.get("accept", "*/*")}
    for h in _FORWARD_HEADERS:
        if h in request.headers:
            fwd_headers[h] = request.headers[h]

    try:
        r = await _client.request(
            request.method, url,
            params=request.query_params,
            headers=fwd_headers,
        )
    except httpx.RequestError as e:
        logger.warning("proxy %s lỗi: %s", url, e)
        raise HTTPException(502, "upstream không phản hồi")

    out_headers = {k: v for k, v in r.headers.items() if k.lower() in _KEEP_HEADERS}

    # CHỈ set immutable khi upstream thực sự trả 200. 404/500 có thể do cấu
    # hình tạm thời; cache 1 ngày sẽ khiến client "kẹt" rất khó debug.
    if r.status_code == 200 and _is_immutable_tile(path):
        out_headers.setdefault("cache-control", "public, max-age=86400, immutable")

    # HEAD: không có body (RFC 7231 §4.3.2).
    content = b"" if request.method == "HEAD" else r.content
    return Response(
        content=content,
        status_code=r.status_code,
        headers=out_headers,
    )


@router.api_route("/tiles/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def proxy_tileserv(path: str, request: Request):
    """Map request /tiles/... → pg_tileserv:7800/..."""
    return await _proxy(settings.TILESERV_URL, path, request)


@router.api_route("/basemap/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def proxy_versatiles(path: str, request: Request):
    """Map /basemap/vietnam/... → versatiles:8080/tiles/vietnam/...

    VersaTiles bắt buộc prefix /tiles/ cho mọi request tile. Proxy tự thêm
    nếu client chưa có, để frontend giữ URL gọn /basemap/vietnam/... và
    không phụ thuộc cấu trúc nội bộ của versatiles.
    """
    if not path.startswith("tiles/"):
        path = f"tiles/{path}"
    return await _proxy(settings.VERSATILES_URL, path, request)


# ---------- MVT tự sinh (fallback khi không dùng pg_tileserv) ----------
@router.get("/mvt/{table}/{z}/{x}/{y}.pbf", include_in_schema=False)
async def mvt_tile(
    table: str, z: int, x: int, y: int,
    pool: asyncpg.Pool = Depends(get_pool),
):
    real = _TABLE_ALIASES.get(table, table)
    if real not in _TABLE_COLUMNS:
        raise HTTPException(404, "bảng không được phép")
    if not (_MIN_ZOOM <= z <= _MAX_ZOOM):
        raise HTTPException(400, f"zoom phải trong [{_MIN_ZOOM}, {_MAX_ZOOM}]")

    cols = _TABLE_COLUMNS[real]
    layer_name = real.split(".")[-1]        # "pois" thay vì "public.pois"
    limit = _feature_limit(z)
    tol = _simplify_tolerance(z)

    # SRID: bounds là 3857 (Web Mercator), geom là 4326.
    #   - Filter  : geom && ST_Transform(bounds, 4326) → transform CHỈ bounds
    #               (1 row), vẫn dùng được GiST index trên geom (SRID 4326).
    #   - Render  : ST_Transform(geom, 3857) → transform TỪNG row nhưng chỉ
    #               trên tập đã lọc nhỏ; dùng ST_SimplifyPreserveTopology để
    #               giảm số điểm theo mức zoom trước khi transform.
    #
    # {cols}, {real} đến từ whitelist → an toàn SQL injection. Không dùng
    # tham số $n cho identifier vì PostgreSQL không hỗ trợ.
    sql = f"""
        WITH bounds AS (
            SELECT ST_TileEnvelope($1::int, $2::int, $3::int) AS geom_3857
        ),
        mvt AS (
            SELECT ST_AsMVT(t.*, $4) AS tile
            FROM (
                SELECT {cols},
                       ST_AsMVTGeom(
                           ST_Transform(
                               ST_SimplifyPreserveTopology(geom, $6::float8),
                               3857
                           ),
                           bounds.geom_3857,
                           4096, 256, true
                       ) AS geom
                FROM {real}, bounds
                WHERE geom && ST_Transform(bounds.geom_3857, 4326)
                LIMIT $5::int
            ) t
        )
        SELECT tile FROM mvt
    """
    tile = await pool.fetchval(sql, z, x, y, layer_name, limit, tol)
    # Tile rỗng: trả body rỗng, vẫn 200 để client cache được.
    return Response(
        content=tile or b"",
        media_type="application/x-protobuf",
        headers={"cache-control": "public, max-age=86400, immutable"},
    )