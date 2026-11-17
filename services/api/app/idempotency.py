"""`Idempotency-Key` support for POST endpoints that create things.

The stored response is written in the same transaction as the created rows, so a retried request
either sees the first response or (on a concurrent duplicate) loses the unique-constraint race and
replays the winner's response. Nothing is created twice.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import Principal
from app.models import IdempotencyRecord


def fingerprint(path: str, body: Any) -> str:
    raw = json.dumps({"p": path, "b": body}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def validate_key(key: str | None) -> str | None:
    if key is None:
        return None
    key = key.strip()
    if not key or len(key) > 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Idempotency-Key must be 1-100 characters")
    return key


def replay(db: Session, principal: Principal, key: str | None, fp: str) -> JSONResponse | None:
    if key is None:
        return None
    rec = db.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.principal == principal.key, IdempotencyRecord.key == key
        )
    )
    if rec is None:
        return None
    if rec.request_fingerprint != fp:
        raise HTTPException(422, "Idempotency-Key was already used with a different request")
    return JSONResponse(
        rec.response_body, status_code=rec.status_code, headers={"Idempotent-Replayed": "true"}
    )


def remember(
    db: Session, principal: Principal, key: str | None, fp: str, status_code: int, body: dict[str, Any]
) -> None:
    if key is None:
        return
    db.add(
        IdempotencyRecord(
            principal=principal.key,
            key=key,
            request_fingerprint=fp,
            status_code=status_code,
            response_body=body,
        )
    )
