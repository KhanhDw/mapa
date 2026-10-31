import os
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from .config import PANORAMAS_DIR, USER_MEDIA_DIR
from .db import get_pool, lifespan
from .routers import contribute, point_info, streetview


def create_app() -> FastAPI:
    app = FastAPI(
        lifespan=lifespan,
        title="Webmap API",
        version="2.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(
        GZipMiddleware,
        minimum_size=1000,
    )

    @app.get("/health", tags=["meta"])
    async def health(pool=Depends(get_pool)):
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")

        return {"status": "ok"}

    # Đăng ký các API router
    app.include_router(streetview.router)
    app.include_router(point_info.router)
    app.include_router(contribute.router)

    # Xác định thư mục ảnh dựa trên cấu hình
    panoramas_dir = Path(PANORAMAS_DIR).resolve()
    user_media_dir = Path(USER_MEDIA_DIR).resolve()

    panoramas_dir.mkdir(parents=True, exist_ok=True)
    user_media_dir.mkdir(parents=True, exist_ok=True)

    # Công khai các thư mục chứa ảnh
    app.mount(
        "/panoramas",
        StaticFiles(directory=str(panoramas_dir)),
        name="panoramas",
    )

    app.mount(
        "/user-media",
        StaticFiles(directory=str(user_media_dir)),
        name="user-media",
    )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["."],
    )