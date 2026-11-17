from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.db import get_engine
from app.storage import get_storage

router = APIRouter(tags=["health"])


@router.get("/health/live")
def live() -> dict[str, str]:
    """Process is up. Does not touch dependencies."""
    return {"status": "ok"}


@router.get("/health/ready")
def ready() -> JSONResponse:
    """Ready to serve: database reachable and migrated, object storage reachable."""
    checks: dict[str, str] = {}
    ok = True
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.execute(text("SELECT 1 FROM alembic_version"))
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        ok = False
        checks["database"] = f"error: {exc.__class__.__name__}"
    try:
        storage = get_storage()
        storage.check()
        checks["storage"] = f"ok ({storage.name})"
    except Exception as exc:  # noqa: BLE001
        ok = False
        checks["storage"] = f"error: {exc.__class__.__name__}"
    settings = get_settings()
    if settings.auth_mode == "supabase":
        try:
            from app.auth import _jwks_client

            keys = _jwks_client(settings.supabase_issuer + "/.well-known/jwks.json").get_signing_keys()
            checks["auth"] = f"ok (supabase, {len(keys)} signing key(s))"
        except Exception as exc:  # noqa: BLE001
            # Legacy HS256 projects have no JWKS; that is fine when the secret is configured.
            if settings.supabase_jwt_secret:
                checks["auth"] = "ok (supabase, HS256 secret)"
            else:
                ok = False
                checks["auth"] = f"error: cannot load Supabase JWKS ({exc.__class__.__name__})"
    else:
        checks["auth"] = "local (development only)"
    return JSONResponse(
        {"status": "ok" if ok else "unavailable", "checks": checks}, status_code=200 if ok else 503
    )
