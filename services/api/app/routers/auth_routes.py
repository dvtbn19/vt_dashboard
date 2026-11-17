from __future__ import annotations

import hmac

from fastapi import APIRouter, HTTPException, status

from app.auth import AppSettings, CurrentPrincipal, issue_local_token
from app.schemas import LocalLogin, MeOut, TokenOut

router = APIRouter(prefix="/v1", tags=["auth"])


@router.get("/me", response_model=MeOut)
def me(principal: CurrentPrincipal) -> MeOut:
    return MeOut(
        kind=principal.kind,
        owner_id=principal.owner_id,
        email=principal.user.email if principal.user else None,
        scopes=sorted(principal.scopes),
    )


@router.post("/auth/local-login", response_model=TokenOut)
def local_login(body: LocalLogin, settings: AppSettings) -> TokenOut:
    """Development-only sign-in. Disabled unless AUTH_MODE=local, which is refused when ENV=production."""
    if settings.auth_mode != "local" or settings.env == "production":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if not settings.local_login_password:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "LOCAL_LOGIN_PASSWORD is not configured")
    email_ok = hmac.compare_digest(body.email.strip().lower(), settings.local_login_email.strip().lower())
    pw_ok = hmac.compare_digest(body.password.encode(), settings.local_login_password.encode())
    if not (email_ok and pw_ok):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong e-mail or password")
    ttl_hours = 12
    from datetime import timedelta

    token = issue_local_token(settings, body.email, timedelta(hours=ttl_hours))
    return TokenOut(access_token=token, expires_in=ttl_hours * 3600)
