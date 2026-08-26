"""
EvalGate Studio FastAPI Backend Application.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from evalgate import __version__
from evalgate.api.routes.arena import router as arena_router
from evalgate.api.routes.evaluate import router as evaluate_router
from evalgate.api.routes.models import router as models_router
from evalgate.api.routes.runs import router as runs_router
from evalgate.api.routes.suites import router as suites_router
from evalgate.api.routes.ws import router as ws_router
from evalgate.core.storage import StorageEngine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context: initialize storage schemas on startup."""
    storage = StorageEngine()
    await storage.init_db()
    yield


def create_app() -> FastAPI:
    """
    Factory creating the configured FastAPI application instance.
    """
    app = FastAPI(
        title="EvalGate Studio API",
        description=(
            "REST & WebSocket API for prompt evaluation, regression testing, and LLM benchmarking."
        ),
        version=__version__,
        lifespan=lifespan,
    )

    # CORS configuration for Next.js Web Studio frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "*",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["System"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    @app.get("/version", tags=["System"])
    async def version_check() -> dict[str, str]:
        return {"version": __version__}

    # Mount API v1 endpoints
    api_v1 = FastAPI(title="EvalGate API v1")
    api_v1.include_router(suites_router)
    api_v1.include_router(runs_router)
    api_v1.include_router(arena_router)
    api_v1.include_router(evaluate_router)
    api_v1.include_router(models_router)
    api_v1.include_router(ws_router)

    app.mount("/api/v1", api_v1)

    return app


# Default application instance for Uvicorn
app = create_app()
