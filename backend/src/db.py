"""Asyncpg pool quản lý tập trung.

- Pool là global, mỗi uvicorn worker sẽ có pool riêng.
- Startup check toàn bộ table cần thiết để cảnh báo sớm nếu thiếu schema.

Lifespan KHÔNG nằm ở đây. main.py compose lifespan từ _init_pool/_close_pool
và các service phụ (vd. tiles client) để tránh import chéo db ↔ routers.
"""
import logging

import asyncpg
from fastapi import HTTPException

from .config import settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None

_REQUIRED_TABLES = (
    "public.pois",
    "public.streetview_images",
    "public.vietnam_roads",
    "user_data.pois",
    "user_data.poi_photos",
)


async def _init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        settings.DATABASE_URL,
        min_size=settings.DB_POOL_MIN,
        max_size=settings.DB_POOL_MAX,
        command_timeout=settings.DB_COMMAND_TIMEOUT,
    )
    async with _pool.acquire() as conn:
        missing: list[str] = []
        for t in _REQUIRED_TABLES:
            exists = await conn.fetchval("SELECT to_regclass($1) IS NOT NULL", t)
            if not exists:
                missing.append(t)

    if missing:
        logger.warning("[startup] Missing tables: %s", ", ".join(missing))
    else:
        logger.info("[startup] PostGIS connected — all required tables present")


async def _close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("[shutdown] PostGIS pool closed")


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise HTTPException(503, "DB not ready")
    return _pool