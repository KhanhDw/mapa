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
from .routers import contribute, point_info, streetview, tiles

logging.basicConfig(
    level=logging.DEBUG if settings.is_dev else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    """Compose lifespan: DB pool + tile proxy client.

    Đặt ở main.py (không phải db.py) để db.py không phải import routers,
    tránh vòng lặp db → routers.tiles → db.
    """
    await _init_pool()
    await tiles.init_client()
    try:
        yield
    finally:
        await tiles.close_client()
        await _close_pool()


class CachedStaticFiles(StaticFiles):
    """StaticFiles + Cache-Control cho ảnh tĩnh (panorama & POI photo)."""

    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        if resp.status_code == 200:
            resp.headers.setdefault(
                "Cache-Control", "public, max-age=86400, immutable"
            )
        return resp


def create_app() -> FastAPI:
    app = FastAPI(
        lifespan=lifespan,
        title="Webmap API",
        version="2.3.0",        # bump vì thêm proxy route
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    @app.get("/health", tags=["meta"])
    async def health(pool: asyncpg.Pool = Depends(get_pool)):
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok"}

    # Routers
    app.include_router(streetview.router)
    app.include_router(point_info.router)
    app.include_router(contribute.router)
    app.include_router(tiles.router)

    # Static assets
    app.mount(
        "/panoramas",
        CachedStaticFiles(directory=str(settings.PANORAMAS_DIR)),
        name="panoramas",
    )
    app.mount(
        "/user-media",
        CachedStaticFiles(directory=str(settings.USER_MEDIA_DIR)),
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