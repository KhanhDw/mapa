
"""Proxy tile requests tới pg_tileserv & versatiles + fallback MVT tự sinh.

Đồng bộ schema DB v2:
- public.vietnam_roads: dùng id thay cho osm_id
- Bổ sung user_data.electric_poles và user_data.vietnam_wards_2025
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


# --------------------------------------------------
# Dynamic tables: dùng chung cho toàn bộ tile system
# --------------------------------------------------

_DYNAMIC_TABLES = frozenset({
    "user_data.pois",
    "user_data.electric_poles",
    "public.streetview_images",
})


# --------------------------------------------------
# MVT whitelist + mapping cột
#
# source_columns: SELECT trong CTE source
# output_columns: SELECT ngoài, trước ST_AsMVTGeom
# --------------------------------------------------

_TABLE_COLUMNS = {
    "public.pois": {
        "source_columns": "id, name, category, fclass",
        "output_columns": "id, name, category, fclass",
    },

    "public.vietnam_roads": {
        "source_columns": "id, name, fclass AS category",
        "output_columns": "id, name, category",
    },

    "public.streetview_images": {
        "source_columns": "id, file_path, heading, pitch",
        "output_columns": "id, file_path, heading, pitch",
    },

    "user_data.pois": {
        "source_columns": "id, name, category, address",
        "output_columns": "id, name, category, address",
    },

    "user_data.electric_poles": {
        "source_columns": "id, pole_code, route, status",
        "output_columns": "id, pole_code, route, status",
    },

    "user_data.vietnam_wards_2025": {
        "source_columns": (
            "ma, tenhc, loai, matinh, tentinh, "
            "dientichkm2, dansonguoi"
        ),
        "output_columns": (
            "ma, tenhc, loai, matinh, tentinh, "
            "dientichkm2, dansonguoi"
        ),
    },
}


_TABLE_ALIASES = {
    "pois": "public.pois",
    "roads": "public.vietnam_roads",
    "streetview": "public.streetview_images",
    "user_pois": "user_data.pois",
    "electric_poles": "user_data.electric_poles",
    "wards": "user_data.vietnam_wards_2025",
}


_MIN_ZOOM = 0
_MAX_ZOOM = 18

# Chỉ hiển thị wards từ zoom 6 trở lên
_MIN_WARDS_ZOOM = 6


def _feature_limit(z: int, table: str | None = None) -> int:
    """Giới hạn số feature trong một tile."""

    limit = min(2000 * (z + 1), 10000)

    if table == "user_data.vietnam_wards_2025":
        limit = min(limit, 500)

    return limit


def _layer_from_path(path: str) -> str:
    """Lấy tên layer từ đường dẫn pg_tileserv."""

    parts = [p for p in path.strip("/").split("/") if p]

    if not parts:
        return ""

    return parts[0]


def _is_dynamic_table(table: str) -> bool:
    return table in _DYNAMIC_TABLES


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


# --------------------------------------------------
# Cache policy
# --------------------------------------------------

def _is_immutable_tile(path: str) -> bool:
    """Chỉ cache immutable cho bảng không thay đổi."""

    layer = _layer_from_path(path)

    if _is_dynamic_table(layer):
        return False

    parts = [p for p in path.split("/") if p]

    if len(parts) < 3:
        return False

    z, x, y_raw = parts[-3], parts[-2], parts[-1]
    y = y_raw.rsplit(".", 1)[0]

    return (
        z.isdigit()
        and x.isdigit()
        and y.isdigit()
    )


# --------------------------------------------------
# Proxy
# --------------------------------------------------

async def _proxy(
    base: str,
    path: str,
    request: Request,
) -> Response:

    if _client is None:
        raise HTTPException(503, "tile proxy chưa sẵn sàng")

    url = f"{base.rstrip('/')}/{path.lstrip('/')}"

    # Nhận diện layer chính xác thay vì tìm chuỗi con
    layer = _layer_from_path(path)
    is_dynamic = _is_dynamic_table(layer)

    fwd_headers = {
        "accept": request.headers.get("accept", "*/*")
    }

    for h in _FORWARD_HEADERS:
        if h in request.headers:
            fwd_headers[h] = request.headers[h]

    try:
        r = await _client.request(
            request.method,
            url,
            params=request.query_params,
            headers=fwd_headers,
        )

    except httpx.RequestError as e:
        logger.warning("proxy %s lỗi: %s", url, e)
        raise HTTPException(502, "upstream không phản hồi")

    out_headers = {
        k: v
        for k, v in r.headers.items()
        if k.lower() in _KEEP_HEADERS
    }

    if r.status_code == 200:

        if is_dynamic:
            out_headers["cache-control"] = (
                "no-cache, no-store, must-revalidate"
            )
            out_headers["pragma"] = "no-cache"
            out_headers["expires"] = "0"

        elif _is_immutable_tile(path):
            out_headers.setdefault(
                "cache-control",
                "public, max-age=86400, immutable",
            )

    content = b"" if request.method == "HEAD" else r.content

    return Response(
        content=content,
        status_code=r.status_code,
        headers=out_headers,
    )


@router.api_route(
    "/tiles/{path:path}",
    methods=["GET", "HEAD"],
    include_in_schema=False,
)
async def proxy_tileserv(path: str, request: Request):
    """Map request /tiles/... → pg_tileserv:7800/..."""

    return await _proxy(
        settings.TILESERV_URL,
        path,
        request,
    )


@router.api_route(
    "/basemap/{path:path}",
    methods=["GET", "HEAD"],
    include_in_schema=False,
)
async def proxy_versatiles(path: str, request: Request):
    """Map /basemap/vietnam/... → versatiles:8080/tiles/vietnam/..."""

    if not path.startswith("tiles/"):
        path = f"tiles/{path}"

    return await _proxy(
        settings.VERSATILES_URL,
        path,
        request,
    )


# --------------------------------------------------
# MVT fallback
# --------------------------------------------------

@router.get(
    "/mvt/{table}/{z}/{x}/{y}.pbf",
    include_in_schema=False,
)
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
        raise HTTPException(
            400,
            "tọa độ tile không hợp lệ",
        )

    # Không tạo tile wards ở zoom thấp
    if (
        real == "user_data.vietnam_wards_2025"
        and z < _MIN_WARDS_ZOOM
    ):
        return Response(
            content=b"",
            media_type="application/x-protobuf",
            headers={
                "cache-control": "public, max-age=86400"
            },
        )

    columns = _TABLE_COLUMNS[real]

    source_columns = columns["source_columns"]
    output_columns = columns["output_columns"]

    # Giữ nguyên layer name để tương thích FE
    layer_name = table

    limit = _feature_limit(z, real)

    is_dynamic = _is_dynamic_table(real)

    cache = (
        "no-cache, no-store, must-revalidate"
        if is_dynamic
        else "public, max-age=86400, immutable"
    )

    # --------------------------------------------------
    # SQL MVT
    # --------------------------------------------------

    sql = f"""
        WITH bounds AS (
            SELECT ST_TileEnvelope(
                $1::int,
                $2::int,
                $3::int
            ) AS geom_3857
        ),

        source AS (
            SELECT
                {source_columns},
                ST_Transform(geom, 3857) AS geom_3857
            FROM {real}
            WHERE geom && ST_Transform(
                ST_TileEnvelope(
                    $1::int,
                    $2::int,
                    $3::int
                ),
                4326
            )
        ),

        mvt AS (
            SELECT ST_AsMVT(t.*, $4) AS tile
            FROM (
                SELECT
                    {output_columns},

                    ST_AsMVTGeom(
                        ST_SimplifyPreserveTopology(
                            source.geom_3857,
                            (
                                ST_XMax(bounds.geom_3857)
                                - ST_XMin(bounds.geom_3857)
                            ) / 8192.0
                        ),
                        bounds.geom_3857,
                        4096,
                        256,
                        true
                    ) AS geom

                FROM source, bounds

                WHERE source.geom_3857 && bounds.geom_3857

                LIMIT $5::int
            ) t

            WHERE geom IS NOT NULL
        )

        SELECT tile FROM mvt
    """

    try:
        tile = await pool.fetchval(
            sql,
            z,
            x,
            y,
            layer_name,
            limit,
        )

    except Exception:
        logger.exception(
            "Tạo MVT thất bại: table=%s z=%s x=%s y=%s",
            real,
            z,
            x,
            y,
        )

        raise HTTPException(
            500,
            "Không thể tạo vector tile",
        )

    return Response(
        content=tile or b"",
        media_type="application/x-protobuf",
        headers={
            "cache-control": cache,
        },
    )
