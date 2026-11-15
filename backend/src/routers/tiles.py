# backend\src\routers\tiles.py
"""Proxy tile requests tới pg_tileserv & versatiles + fallback MVT tự sinh.

Đồng bộ schema DB v2:
- public.vietnam_roads: dùng id thay cho osm_id
- Bổ sung user_data.electric_poles và user_data.vietnam_wards_2025 vào MVT fallback
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

_KEEP_HEADERS = {
    "content-type",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
    "cache-control",
}

_FORWARD_HEADERS = (
    "range",
    "if-none-match",
    "if-modified-since",
)

# ---- MVT: whitelist table + map cột theo schema thực tế ----
_TABLE_COLUMNS = {
    "public.pois":                  "id, name, category, fclass",
    "public.vietnam_roads":         "id, name, fclass AS category",
    "public.streetview_images":     "id, file_path, heading, pitch",
    "user_data.pois":               "id, name, category, address",
    "user_data.electric_poles":     "id, pole_code, route, status",
    "user_data.vietnam_wards_2025": "ma, tenhc, loai, matinh, tentinh",
}

_TABLE_ALIASES = {
    "pois":           "public.pois",
    "roads":          "public.vietnam_roads",
    "streetview":     "public.streetview_images",
    "user_pois":      "user_data.pois",
    "electric_poles": "user_data.electric_poles",
    "wards":          "user_data.vietnam_wards_2025",
}

_MIN_ZOOM = 0
_MAX_ZOOM = 18


def _feature_limit(z: int) -> int:
    return 2000 * (z + 1)


def _simplify_tolerance(z: int) -> float:
    return 360.0 / (2 ** z * 4096)


async def init_client() -> None:
    global _client
    _client = httpx.AsyncClient(
        timeout=httpx.Timeout(
            settings.PROXY_TIMEOUT_S,
            connect=settings.PROXY_CONNECT_TIMEOUT_S,
        ),
        headers={"accept-encoding": "identity"},
        follow_redirects=False,
    )


async def close_client() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None


def _is_immutable_tile(path: str) -> bool:
    """Chỉ cache immutable cho dữ liệu nền tĩnh (public.*, vietnam_wards_2025).
    Các bảng user_data động (pois, electric_poles) không cache immutable."""
    if "user_data.pois" in path or "user_data.electric_poles" in path:
        return False

    parts = [p for p in path.split("/") if p]
    if len(parts) < 3:
        return False
    z, x, y_raw = parts[-3], parts[-2], parts[-1]
    y = y_raw.rsplit(".", 1)[0]
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

    if r.status_code == 200:
        if "user_data.pois" in path or "user_data.electric_poles" in path:
            out_headers["cache-control"] = "no-cache, no-store, must-revalidate"
            out_headers["pragma"] = "no-cache"
            out_headers["expires"] = "0"
        elif _is_immutable_tile(path):
            out_headers.setdefault("cache-control", "public, max-age=86400, immutable")

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
    """Map /basemap/vietnam/... → versatiles:8080/tiles/vietnam/..."""
    if not path.startswith("tiles/"):
        path = f"tiles/{path}"
    return await _proxy(settings.VERSATILES_URL, path, request)


# ---------- MVT tự sinh (fallback khi không dùng pg_tileserv) ----------
@router.get("/mvt/{table}/{z}/{x}/{y}.pbf", include_in_schema=False)
async def mvt_tile(
    table: str,
    z: int,
    x: int,
    y: int,
    pool: asyncpg.Pool = Depends(get_pool),
):
    real = _TABLE_ALIASES.get(table, table)

    if real not in _TABLE_COLUMNS:
        raise HTTPException(404, "bảng không được phép")

    if not (_MIN_ZOOM <= z <= _MAX_ZOOM):
        raise HTTPException(
            400,
            f"zoom phải trong [{_MIN_ZOOM}, {_MAX_ZOOM}]",
        )

    if not (0 <= x < 2**z and 0 <= y < 2**z):
        raise HTTPException(400, "tọa độ tile không hợp lệ")

    cols = _TABLE_COLUMNS[real]
    layer_name = (
        real if real.startswith("user_data.")
        else real.split(".")[-1]
    )

    limit = _feature_limit(z)
    tol = _simplify_tolerance(z)

    is_dynamic = real in ("user_data.pois", "user_data.electric_poles")
    cache = (
        "no-cache, no-store, must-revalidate"
        if is_dynamic
        else "public, max-age=86400, immutable"
    )

    sql = f"""
        WITH bounds AS (
            SELECT ST_TileEnvelope(
                $1::int, $2::int, $3::int
            ) AS geom_3857
        ),
        mvt AS (
            SELECT ST_AsMVT(t.*, $4) AS tile
            FROM (
                SELECT
                    {cols},
                    ST_AsMVTGeom(
                        ST_Transform(
                            ST_SimplifyPreserveTopology(
                                geom, $6::float8
                            ),
                            3857
                        ),
                        bounds.geom_3857,
                        4096,
                        256,
                        true
                    ) AS geom
                FROM {real}, bounds
                WHERE geom && ST_Transform(
                    bounds.geom_3857, 4326
                )
                LIMIT $5::int
            ) t
        )
        SELECT tile FROM mvt
    """

    try:
        tile = await pool.fetchval(
            sql, z, x, y, layer_name, limit, tol
        )
    except Exception:
        logger.exception(
            "Tạo MVT thất bại: table=%s z=%s x=%s y=%s",
            real, z, x, y,
        )
        raise HTTPException(500, "Không thể tạo vector tile")

    return Response(
        content=tile or b"",
        media_type="application/x-protobuf",
        headers={"cache-control": cache},
    )
