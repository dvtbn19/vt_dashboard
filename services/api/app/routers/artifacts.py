"""Artifact lifecycle: initiate → client PUTs bytes to a signed URL → complete (verify) → download/preview.

Uploaded content is untrusted. We never serve it from the web app origin, never execute it,
send downloads of non-images as attachments, and bound every preview.
"""

from __future__ import annotations

import codecs
import csv
import io
import json
import re
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import idempotency as idem
from app.auth import SCOPE_ARTIFACTS_WRITE, SCOPE_READ, AppSettings, CurrentPrincipal, DbSession, Principal
from app.models import Artifact, Run, utcnow
from app.routers.runs import get_run_for
from app.schemas import (
    ArtifactInitiate,
    ArtifactInitiated,
    ArtifactOut,
    ArtifactPreview,
    DownloadLink,
    UploadInstructions,
)
from app.storage import Storage, get_storage

router = APIRouter(prefix="/v1", tags=["artifacts"])
StorageDep = Annotated[Storage, Depends(get_storage)]

# MIME type → artifact kind. Anything else is rejected for now (Parquet/HTML come later).
MIME_KINDS: dict[str, str] = {
    "image/png": "image",
    "image/jpeg": "image",
    "text/csv": "csv",
    "text/markdown": "markdown",
    "application/vnd.plotly.v1+json": "plotly",
}
JSON_MIMES = {"application/json", "application/vnd.plotly.v1+json"}
SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _normalize_mime(mime: str) -> str:
    return mime.split(";", 1)[0].strip().lower()


def _resolve_kind(mime: str, kind: str | None) -> tuple[str, str]:
    mime = _normalize_mime(mime)
    if mime in JSON_MIMES and kind in (None, "plotly"):
        return "application/vnd.plotly.v1+json", "plotly"
    detected = MIME_KINDS.get(mime)
    if detected is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported MIME type '{mime}'. Allowed: {', '.join(sorted(MIME_KINDS))}, application/json (plotly)",
        )
    if kind is not None and kind != detected:
        raise HTTPException(422, f"kind '{kind}' does not match MIME type '{mime}'")
    return mime, detected


def get_artifact_for(db: Session, principal: Principal, artifact_id: uuid.UUID) -> Artifact:
    artifact = db.get(Artifact, artifact_id)
    if artifact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Artifact not found")
    run = db.get(Run, artifact.run_id)
    if run is None or not principal.can_access_project(run.project):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Artifact not found")
    return artifact


@router.post(
    "/runs/{run_id}/artifacts/initiate", response_model=ArtifactInitiated, status_code=status.HTTP_201_CREATED
)
def initiate_artifact(
    run_id: uuid.UUID,
    body: ArtifactInitiate,
    principal: CurrentPrincipal,
    db: DbSession,
    settings: AppSettings,
    storage: StorageDep,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> JSONResponse:
    principal.require_scope(SCOPE_ARTIFACTS_WRITE)
    run = get_run_for(db, principal, run_id)
    if run.status != "running":
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Run is {run.status}; artifacts can only be added while running"
        )
    mime, kind = _resolve_kind(body.mime_type, body.kind)
    limit = settings.preview_json_max_bytes if kind == "plotly" else settings.max_artifact_bytes
    if body.size_bytes > limit:
        raise HTTPException(413, f"File too large (max {limit} bytes for {kind})")

    key = idem.validate_key(idempotency_key)
    fp = idem.fingerprint(f"artifact:{run.id}", body.model_dump())
    if (replayed := idem.replay(db, principal, key, fp)) is not None:
        # A replay must hand out a fresh upload URL (the original may have expired).
        data = replayed.body
        stored = json.loads(bytes(data))
        art = db.get(Artifact, uuid.UUID(stored["artifact"]["id"]))
        if art is not None and art.status == "pending_upload":
            signed = storage.presign_put(art.object_key, art.mime_type, art.size_bytes)
            stored["upload"] = jsonable_encoder(UploadInstructions(**signed.__dict__))
        return JSONResponse(stored, status_code=replayed.status_code, headers={"Idempotent-Replayed": "true"})

    artifact_id = uuid.uuid4()
    base = SAFE_NAME.sub("_", body.name).strip("._")[:120] or "artifact"
    object_key = f"projects/{run.project_id}/runs/{run.id}/{artifact_id}/{base}"
    artifact = Artifact(
        id=artifact_id,
        run_id=run.id,
        name=body.name,
        kind=kind,
        mime_type=mime,
        object_key=object_key,
        size_bytes=body.size_bytes,
        checksum_sha256=body.checksum_sha256,
        description=body.description,
        status="pending_upload",
    )
    db.add(artifact)
    db.flush()
    signed = storage.presign_put(object_key, mime, body.size_bytes)
    payload = jsonable_encoder(
        ArtifactInitiated(
            artifact=ArtifactOut.model_validate(artifact), upload=UploadInstructions(**signed.__dict__)
        )
    )
    idem.remember(db, principal, key, fp, 201, payload)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Concurrent duplicate request; retry") from None
    return JSONResponse(payload, status_code=201)


def _verify_content(artifact: Artifact, storage: Storage, settings: Any) -> str | None:
    """Return a failure reason, or None if the stored object is acceptable."""
    if artifact.checksum_sha256 and artifact.size_bytes <= settings.checksum_verify_max_bytes:
        if storage.sha256(artifact.object_key) != artifact.checksum_sha256:
            return "Checksum mismatch"
    head = storage.read_prefix(artifact.object_key, 8192)
    if artifact.kind == "image":
        if artifact.mime_type == "image/png" and not head.startswith(b"\x89PNG\r\n\x1a\n"):
            return "Content is not a PNG image"
        if artifact.mime_type == "image/jpeg" and not head.startswith(b"\xff\xd8\xff"):
            return "Content is not a JPEG image"
    elif artifact.kind in ("csv", "markdown"):
        if b"\x00" in head:
            return "Text artifact contains binary data"
        try:
            codecs.getincrementaldecoder("utf-8")().decode(head, final=artifact.size_bytes <= len(head))
        except UnicodeDecodeError:
            return "Text artifact is not valid UTF-8"
    elif artifact.kind == "plotly":
        try:
            fig = json.loads(storage.read_prefix(artifact.object_key, settings.preview_json_max_bytes))
        except (ValueError, UnicodeDecodeError):
            return "Plotly artifact is not valid JSON"
        if not isinstance(fig, dict) or not isinstance(fig.get("data"), list):
            return "Plotly JSON must be an object with a 'data' list"
    return None


@router.post("/artifacts/{artifact_id}/complete", response_model=ArtifactOut)
def complete_artifact(
    artifact_id: uuid.UUID,
    principal: CurrentPrincipal,
    db: DbSession,
    settings: AppSettings,
    storage: StorageDep,
) -> Artifact:
    principal.require_scope(SCOPE_ARTIFACTS_WRITE)
    artifact = get_artifact_for(db, principal, artifact_id)
    if artifact.status in ("ready", "failed"):
        return artifact  # idempotent
    size = storage.size(artifact.object_key)
    if size is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Upload not found; PUT the file to the upload URL first"
        )
    reason = None
    if size != artifact.size_bytes:
        reason = f"Size mismatch: declared {artifact.size_bytes}, stored {size}"
    else:
        reason = _verify_content(artifact, storage, settings)
    artifact.status = "failed" if reason else "ready"
    artifact.failure_reason = reason
    artifact.finalized_at = utcnow()
    db.commit()
    if reason:
        raise HTTPException(422, f"Artifact rejected: {reason}")
    return artifact


@router.get("/artifacts/{artifact_id}", response_model=ArtifactOut)
def get_artifact(artifact_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession) -> Artifact:
    principal.require_scope(SCOPE_READ)
    return get_artifact_for(db, principal, artifact_id)


def _ready(artifact: Artifact) -> None:
    if artifact.status != "ready":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Artifact is {artifact.status}")


@router.get("/artifacts/{artifact_id}/download", response_model=DownloadLink)
def download_artifact(
    artifact_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession, storage: StorageDep
) -> DownloadLink:
    """Short-lived signed URL. Only images are served inline; everything else is an attachment."""
    principal.require_scope(SCOPE_READ)
    artifact = get_artifact_for(db, principal, artifact_id)
    _ready(artifact)
    signed = storage.presign_get(
        artifact.object_key, artifact.name, artifact.mime_type, inline=artifact.kind == "image"
    )
    return DownloadLink(
        url=signed.url, expires_at=signed.expires_at, filename=artifact.name, mime_type=artifact.mime_type
    )


def _sanitize_figure(fig: dict[str, Any]) -> dict[str, Any]:
    raw_layout = fig.get("layout")
    layout: dict[str, Any] = raw_layout if isinstance(raw_layout, dict) else {}
    # Drop layout images (arbitrary remote URLs) and anything that is not data/layout.
    layout = {k: v for k, v in layout.items() if k not in ("images", "template")}
    return {"data": fig.get("data", []), "layout": layout}


@router.get("/artifacts/{artifact_id}/preview", response_model=ArtifactPreview)
def preview_artifact(
    artifact_id: uuid.UUID,
    principal: CurrentPrincipal,
    db: DbSession,
    settings: AppSettings,
    storage: StorageDep,
    rows: int = Query(default=0, ge=0, le=500),
) -> ArtifactPreview:
    """Bounded, parsed preview for the UI. Never returns raw HTML or executes content."""
    principal.require_scope(SCOPE_READ)
    artifact = get_artifact_for(db, principal, artifact_id)
    _ready(artifact)
    if artifact.kind == "image":
        signed = storage.presign_get(artifact.object_key, artifact.name, artifact.mime_type, inline=True)
        return ArtifactPreview(kind="image", url=signed.url)
    if artifact.kind == "csv":
        limit = settings.preview_csv_max_bytes
        raw = storage.read_prefix(artifact.object_key, limit)
        truncated_bytes = artifact.size_bytes > len(raw)
        text = raw.decode("utf-8", errors="replace")
        if truncated_bytes and "\n" in text:
            text = text[: text.rfind("\n")]
        max_rows = rows or settings.preview_csv_rows
        reader = csv.reader(io.StringIO(text))
        header = [c[:200] for c in next(reader, [])][:50]
        body: list[list[str]] = []
        more = False
        for row in reader:
            if len(body) >= max_rows:
                more = True
                break
            body.append([c[:200] for c in row[:50]])
        return ArtifactPreview(kind="csv", columns=header, rows=body, truncated=more or truncated_bytes)
    if artifact.kind == "markdown":
        limit = settings.preview_text_max_bytes
        raw = storage.read_prefix(artifact.object_key, limit)
        return ArtifactPreview(
            kind="markdown",
            text=raw.decode("utf-8", errors="replace"),
            truncated=artifact.size_bytes > len(raw),
        )
    if artifact.kind == "plotly":
        fig = json.loads(storage.read_prefix(artifact.object_key, settings.preview_json_max_bytes))
        return ArtifactPreview(kind="plotly", figure=_sanitize_figure(fig))
    raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "No preview for this artifact type")
