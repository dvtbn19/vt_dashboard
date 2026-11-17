"""Authentication and authorization.

Two kinds of callers:
- Humans: `Authorization: Bearer <JWT>` issued by Supabase Auth (or, in development only, by
  `/v1/auth/local-login`). Verified here, never trusted from the UI.
- Scripts/agents: `Authorization: Bearer vtl_<secret>` agent credentials (hashed, scoped, revocable).
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import AgentCredential, Project, User, utcnow

log = logging.getLogger("vtcons.auth")

AGENT_TOKEN_PREFIX = "vtl_"
LOCAL_ISSUER = "vtcons-lab-local"
LOCAL_USER_NAMESPACE = uuid.UUID("5d1c1b64-3a5c-4f8e-9a51-6f5c1f6f0a11")

SCOPE_READ = "read"
SCOPE_RUNS_WRITE = "runs:write"
SCOPE_ARTIFACTS_WRITE = "artifacts:write"
ALL_SCOPES = (SCOPE_READ, SCOPE_RUNS_WRITE, SCOPE_ARTIFACTS_WRITE)
ALL_PROJECTS = "*"


@dataclass
class Principal:
    kind: str  # "user" | "agent"
    owner_id: uuid.UUID
    user: User | None = None
    credential: AgentCredential | None = None
    scopes: frozenset[str] = field(default_factory=frozenset)

    @property
    def key(self) -> str:
        """Stable identifier used to namespace idempotency keys."""
        if self.credential is not None:
            return f"agent:{self.credential.id}"
        return f"user:{self.owner_id}"

    def require_scope(self, scope: str) -> None:
        if self.kind == "agent" and scope not in self.scopes:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Credential lacks scope '{scope}'")

    def can_access_project(self, project: Project) -> bool:
        if project.owner_id != self.owner_id:
            return False
        if self.kind == "agent":
            assert self.credential is not None
            allowed = self.credential.project_ids or []
            return ALL_PROJECTS in allowed or str(project.id) in allowed
        return True


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_agent_token() -> tuple[str, str, str]:
    """Return (token, prefix, sha256 hash). The token is shown to the user exactly once."""
    token = AGENT_TOKEN_PREFIX + secrets.token_urlsafe(32)
    return token, token[:12], hash_token(token)


def local_user_id(email: str) -> uuid.UUID:
    return uuid.uuid5(LOCAL_USER_NAMESPACE, email.strip().lower())


def issue_local_token(settings: Settings, email: str, ttl: timedelta = timedelta(hours=12)) -> str:
    if settings.auth_mode != "local" or settings.env == "production":
        raise RuntimeError("Local tokens are only available in development")
    now = datetime.now(UTC)
    claims = {
        "sub": str(local_user_id(email)),
        "email": email.strip().lower(),
        "aud": settings.supabase_jwt_audience,
        "iss": LOCAL_ISSUER,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
        "role": "authenticated",
    }
    return jwt.encode(claims, settings.local_jwt_secret, algorithm="HS256")


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


def _unauthorized(detail: str = "Invalid or expired token") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def verify_user_jwt(token: str, settings: Settings) -> dict[str, Any]:
    try:
        if settings.auth_mode == "local":
            return jwt.decode(
                token,
                settings.local_jwt_secret,
                algorithms=["HS256"],
                audience=settings.supabase_jwt_audience,
                issuer=LOCAL_ISSUER,
                options={"require": ["exp", "sub"]},
            )
        issuer = settings.supabase_issuer
        header = jwt.get_unverified_header(token)
        if header.get("alg") == "HS256":
            if not settings.supabase_jwt_secret:
                raise _unauthorized()
            key: Any = settings.supabase_jwt_secret
            algorithms = ["HS256"]
        else:
            key = _jwks_client(issuer + "/.well-known/jwks.json").get_signing_key_from_jwt(token).key
            algorithms = ["ES256", "RS256"]
        return jwt.decode(
            token,
            key,
            algorithms=algorithms,
            audience=settings.supabase_jwt_audience,
            issuer=issuer,
            options={"require": ["exp", "sub"]},
            leeway=30,
        )
    except HTTPException:
        raise
    except (jwt.PyJWTError, ValueError) as exc:
        # Logged server-side (no token contents) so deployment problems are diagnosable.
        log.warning("JWT rejected: %s: %s", exc.__class__.__name__, exc)
        raise _unauthorized() from exc


def _user_from_claims(db: Session, claims: dict[str, Any], settings: Settings) -> User:
    email = str(claims.get("email") or "").strip().lower()
    try:
        user_id = uuid.UUID(str(claims["sub"]))
    except ValueError as exc:
        raise _unauthorized() from exc
    allowed = settings.allowed_emails
    if allowed and email not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not allowed to use the lab")
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=email or f"{user_id}@unknown")
        db.add(user)
        db.commit()
    elif email and user.email != email:
        user.email = email
        db.commit()
    return user


def get_principal(
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorized("Missing bearer token")
    token = authorization[7:].strip()
    if token.startswith(AGENT_TOKEN_PREFIX):
        cred = db.scalar(select(AgentCredential).where(AgentCredential.token_hash == hash_token(token)))
        if cred is None or not hmac.compare_digest(cred.token_hash, hash_token(token)):
            raise _unauthorized("Unknown agent token")
        now = utcnow()
        if cred.revoked_at is not None:
            raise _unauthorized("Agent token has been revoked")
        expires = cred.expires_at
        if expires is not None:
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=UTC)
            if expires <= now:
                raise _unauthorized("Agent token has expired")
        cred.last_used_at = now
        db.commit()
        return Principal(kind="agent", owner_id=cred.owner_id, credential=cred, scopes=frozenset(cred.scopes))
    claims = verify_user_jwt(token, settings)
    user = _user_from_claims(db, claims, settings)
    return Principal(kind="user", owner_id=user.id, user=user, scopes=frozenset(ALL_SCOPES))


def require_user(principal: Annotated[Principal, Depends(get_principal)]) -> Principal:
    if principal.kind != "user":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This endpoint requires a signed-in user")
    return principal


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]
CurrentUser = Annotated[Principal, Depends(require_user)]
DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]
