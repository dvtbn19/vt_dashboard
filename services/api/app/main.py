from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import DBAPIError

from app.config import get_settings
from app.routers import (
    artifacts,
    auth_routes,
    credentials,
    dashboards,
    health,
    notebooks,
    notes,
    projects,
    queries,
    runs,
    storage_local,
)


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
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
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

    @app.exception_handler(DBAPIError)
    async def _db_error(request: Request, exc: DBAPIError) -> JSONResponse:
        # Unhandled database errors: log the traceback and return the server's primary message and
        # SQLSTATE (no parameters, no DETAIL lines) so deployment problems are visible in the UI.
        logging.getLogger("vtcons.api").exception("Database error on %s %s", request.method, request.url.path)
        diag = getattr(exc.orig, "diag", None)
        first_line = (str(exc.orig).strip().splitlines() or [""])[0]
        primary = getattr(diag, "message_primary", None) or f"{exc.orig.__class__.__name__}: {first_line}"
        sqlstate = getattr(diag, "sqlstate", None) or "?"
        return JSONResponse({"detail": f"Database error ({sqlstate}): {primary}"[:300]}, status_code=500)

    app.include_router(health.router)
    app.include_router(auth_routes.router)
    app.include_router(projects.router)
    app.include_router(runs.router)
    app.include_router(artifacts.router)
    app.include_router(credentials.router)
    app.include_router(notes.router)
    app.include_router(queries.router)
    app.include_router(notebooks.router)
    app.include_router(dashboards.router)
    if settings.storage_backend == "local":
        app.include_router(storage_local.router)
    return app


def misconfigured_app(exc: ValidationError) -> FastAPI:
    """Serve a clear 503 instead of crashing on import when required settings are missing/invalid.

    Only setting names and validator messages are exposed, never values.
    """
    problems = [
        {"setting": ".".join(str(p) for p in e.get("loc", ())) or "settings", "problem": e.get("msg", "")}
        for e in exc.errors(include_input=False, include_url=False)
    ]
    fallback = FastAPI(
        title="VTCONS Project Lab API (misconfigured)", docs_url=None, redoc_url=None, openapi_url=None
    )

    @fallback.api_route("/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
    def _misconfigured(path: str) -> JSONResponse:
        return JSONResponse({"status": "misconfigured", "problems": problems}, status_code=503)

    return fallback


try:
    app = create_app()
except ValidationError as _exc:  # pragma: no cover - exercised in deployment
    app = misconfigured_app(_exc)
