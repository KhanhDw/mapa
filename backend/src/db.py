
"""
Asyncpg pool quản lý tập trung.

- Pool là global, mỗi uvicorn worker sẽ có pool riêng.
- Startup kiểm tra các bảng bắt buộc.
- Dev: cảnh báo nếu thiếu bảng.
- Prod: dừng startup nếu thiếu bảng.

Lifespan KHÔNG nằm ở đây. main.py compose lifespan từ
_init_pool/_close_pool và các service phụ.
"""

import logging
from typing import Protocol

import asyncpg
from fastapi import HTTPException

from .config import settings


logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


# Interface tối thiểu mà hàm kiểm tra schema cần sử dụng.
# PoolConnectionProxy của asyncpg đáp ứng interface này.
class DBConnection(Protocol):
    async def fetchval(
        self,
        query: str,
        *args: object,
    ) -> object:
        ...


_REQUIRED_TABLES = (
    "public.pois",
    "public.streetview_images",
    "public.vietnam_roads",
    "user_data.pois",
    "user_data.poi_photos",
    "user_data.electric_poles",
    "user_data.vietnam_wards_2025",
)


async def _check_required_tables(
    conn: DBConnection,
) -> list[str]:
    """Trả về danh sách bảng bắt buộc chưa tồn tại."""

    missing: list[str] = []

    for table in _REQUIRED_TABLES:
        exists = await conn.fetchval(
            "SELECT to_regclass($1) IS NOT NULL",
            table,
        )

        if not exists:
            missing.append(table)

    return missing


async def _init_pool() -> None:
    """Khởi tạo connection pool và kiểm tra schema database."""

    global _pool

    if _pool is not None:
        logger.warning(
            "[startup] Database pool already initialized"
        )
        return

    pool: asyncpg.Pool | None = None

    try:
        pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=settings.DB_POOL_MIN,
            max_size=settings.DB_POOL_MAX,
            command_timeout=settings.DB_COMMAND_TIMEOUT,
        )

        async with pool.acquire() as conn:
            missing = await _check_required_tables(conn)

        if missing:
            message = (
                "[startup] Missing required tables: "
                + ", ".join(missing)
            )

            if settings.is_prod:
                logger.critical(
                    "%s. Refusing to start in production.",
                    message,
                )
                raise RuntimeError(message)

            logger.warning(
                "%s. Continuing in non-production environment.",
                message,
            )

        else:
            logger.info(
                "[startup] PostGIS connected — "
                "all required tables present"
            )

        # Chỉ gán pool sau khi khởi tạo và kiểm tra thành công.
        _pool = pool

    except Exception:
        if pool is not None:
            await pool.close()

        logger.exception(
            "[startup] Database initialization failed"
        )
        raise


async def _close_pool() -> None:
    """Đóng connection pool khi ứng dụng shutdown."""

    global _pool

    if _pool is not None:
        await _pool.close()
        _pool = None

        logger.info(
            "[shutdown] PostGIS pool closed"
        )


def get_pool() -> asyncpg.Pool:
    """Lấy database pool từ các router/service."""

    if _pool is None:
        raise HTTPException(
            status_code=503,
            detail="DB not ready",
        )

    return _pool
