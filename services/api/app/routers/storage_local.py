"""Signed-URL endpoints for the local development storage adapter.

These mimic what R2 presigned URLs do in the cloud: the URL itself is the (short-lived, HMAC-signed)
authorization, scoped to one object key and one operation.
"""

from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import select

from app.auth import DbSession
from app.models import Artifact
from app.storage import LocalStorage, StorageError, get_storage

router = APIRouter(prefix="/v1/storage/local", tags=["storage"], include_in_schema=False)

UNTRUSTED_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": "private, max-age=60",
    "Referrer-Policy": "no-referrer",
}


def _local() -> LocalStorage:
    storage = get_storage()
    if not isinstance(storage, LocalStorage):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return storage


@router.put("/{token}", status_code=status.HTTP_200_OK)
async def upload(token: str, request: Request, db: DbSession) -> Response:
    storage = _local()
    try:
        claims = storage.verify(token, "put")
    except StorageError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    content_type = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if content_type != claims["ct"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Content-Type does not match the signed upload")
    artifact = db.scalar(select(Artifact).where(Artifact.object_key == claims["k"]))
    if artifact is None or artifact.status != "pending_upload":
        raise HTTPException(status.HTTP_409_CONFLICT, "Artifact is not awaiting upload")
    max_size = int(claims["sz"])
    path = storage.path_for(claims["k"])
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.part")
    written = 0
    try:
        with tmp.open("wb") as fh:
            async for chunk in request.stream():
                written += len(chunk)
                if written > max_size:
                    raise HTTPException(413, "Upload exceeds declared size")
                fh.write(chunk)
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()
    return Response(status_code=200)


@router.get("/{token}")
def download(token: str) -> FileResponse:
    storage = _local()
    try:
        claims = storage.verify(token, "get")
        path = storage.path_for(claims["k"])
    except StorageError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    headers = dict(UNTRUSTED_HEADERS)
    headers["Content-Disposition"] = claims["cd"]
    return FileResponse(path, media_type=claims["ct"], headers=headers)
