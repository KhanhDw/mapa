import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from .config import PANORAMAS_DIR
from .db import get_pool, lifespan
from .routers import point_info, streetview


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan, title="Webmap API", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    @app.get("/health", tags=["meta"])
    async def health(pool=Depends(get_pool)):
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok"}

    app.include_router(streetview.router)
    app.include_router(point_info.router)

    os.makedirs(PANORAMAS_DIR, exist_ok=True)
    app.mount("/panoramas", StaticFiles(directory=PANORAMAS_DIR), name="panoramas")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["backend"],
    )