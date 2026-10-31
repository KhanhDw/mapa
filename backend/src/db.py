from contextlib import asynccontextmanager
import asyncpg
from fastapi import HTTPException

from .config import DATABASE_URL

_pool: asyncpg.Pool | None = None


async def _init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        DATABASE_URL, min_size=2, max_size=10, command_timeout=10,
    )
    async with _pool.acquire() as conn:
        has_pois = bool(await conn.fetchval(
            "SELECT to_regclass('public.pois') IS NOT NULL"
        ))
    print(f"[startup] Connected to PostGIS | pois table: {has_pois}")


async def _close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        print("[shutdown] PostGIS pool closed")


@asynccontextmanager
async def lifespan(app):
    await _init_pool()
    yield
    await _close_pool()


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise HTTPException(503, "DB not ready")
    return _pool