
import logging
from contextlib import asynccontextmanager

import asyncpg
import uvicorn
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import _close_pool, _init_pool, get_pool
from .routers import (
    auth,
    contribute,
    contribute_public,
    electric_poles,
    point_info,
    poi_management,
    search,
    streetview,
    tiles,
)

logging.basicConfig(
    level=logging.DEBUG if settings.is_dev else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    """Compose lifespan: DB pool + tile proxy client."""
    await _init_pool()
    await tiles.init_client()

    try:
        yield
    finally:
        await tiles.close_client()
        await _close_pool()


class CachedStaticFiles(StaticFiles):
    def __init__(self, *args, cache_control="public, max-age=86400", **kwargs):
        super().__init__(*args, **kwargs)
        self.cache_control = cache_control

    async def get_response(self, path, scope):
        logger.debug("[static] request path=%r", path)

        resp = await super().get_response(path, scope)

        logger.debug("[static] status=%s", resp.status_code)

        if resp.status_code == 200:
            resp.headers.setdefault(
                "Cache-Control",
                self.cache_control,
            )

        return resp


def create_app() -> FastAPI:
    logger.info("[MOUNT] CWD = %s", __import__("os").getcwd())
    logger.info("[MOUNT] PANORAMAS_DIR = %s", settings.PANORAMAS_DIR)
    logger.info(
        "[MOUNT] pano exists = %s",
        settings.PANORAMAS_DIR.exists(),
    )

    app = FastAPI(
        lifespan=lifespan,
        title="Webmap API",
        version="3.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(
        GZipMiddleware,
        minimum_size=1000,
    )

    @app.get("/api/health", tags=["meta"])
    async def health(pool: asyncpg.Pool = Depends(get_pool)):
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")

        return {"status": "ok"}

    # Routers đã tự khai báo prefix /api
    app.include_router(auth.router)
    app.include_router(streetview.router)
    app.include_router(point_info.router)
    app.include_router(search.router)
    app.include_router(contribute.router)
    app.include_router(contribute_public.router)
    app.include_router(electric_poles.router)
    app.include_router(poi_management.router)

    # Tiles chưa khai báo prefix nội bộ
    app.include_router(tiles.router, prefix="/api")

    # Static assets
    app.mount(
        "/panoramas",
        CachedStaticFiles(
            directory=str(settings.PANORAMAS_DIR),
            cache_control="public, max-age=300",
        ),
        name="panoramas",
    )

    app.mount(
        "/user-media",
        CachedStaticFiles(
            directory=str(settings.USER_MEDIA_DIR),
            cache_control="public, max-age=86400",
        ),
        name="user-media",
    )

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["."],
    )
