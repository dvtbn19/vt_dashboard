from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import artifacts, auth_routes, credentials, health, projects, runs, storage_local


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="VTCONS Project Lab API",
        version="0.1.0",
        docs_url="/docs" if settings.env != "production" else None,
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PATCH", "PUT"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        allow_credentials=False,
    )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Echoing `input` back can fail (e.g. NaN is not valid JSON) and can leak large payloads.
        errors = [
            {"loc": list(e.get("loc", ())), "msg": e.get("msg", ""), "type": e.get("type", "")}
            for e in exc.errors()
        ]
        return JSONResponse({"detail": errors}, status_code=422)

    app.include_router(health.router)
    app.include_router(auth_routes.router)
    app.include_router(projects.router)
    app.include_router(runs.router)
    app.include_router(artifacts.router)
    app.include_router(credentials.router)
    if settings.storage_backend == "local":
        app.include_router(storage_local.router)
    return app


app = create_app()
