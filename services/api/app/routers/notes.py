"""Project working notes (Markdown), editable by the owner in the Lab and by scoped agents."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import idempotency as idem
from app.auth import SCOPE_NOTES_WRITE, SCOPE_READ, CurrentPrincipal, CurrentUser, DbSession, Principal
from app.models import Note, Project, SavedQuery, utcnow
from app.routers.projects import get_project_for
from app.schemas import NoteCreate, NoteLink, NoteListItem, NoteOut, NoteUpdate

router = APIRouter(prefix="/v1", tags=["notes"])
IdemKey = Annotated[str | None, Header(alias="Idempotency-Key")]


def get_note_for(db: Session, principal: Principal, note_id: uuid.UUID) -> Note:
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    project = db.get(Project, note.project_id)
    if project is None or not principal.can_access_project(project):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    return note


def clean_links(db: Session, project_id: uuid.UUID, links: list[NoteLink]) -> list[dict[str, str]]:
    """Dedupe links and keep only queries of the note's project.

    Unknown ids are dropped rather than rejected: a query deleted while the note was open in an editor
    must not make the next autosave fail.
    """
    ids = {link.query_id for link in links}
    valid: set[uuid.UUID] = set()
    if ids:
        valid = set(
            db.scalars(
                select(SavedQuery.id).where(SavedQuery.project_id == project_id, SavedQuery.id.in_(ids))
            )
        )
    out: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for link in links:
        item = (str(link.query_id), link.section.strip())
        if link.query_id in valid and item not in seen:
            seen.add(item)
            out.append({"query_id": item[0], "section": item[1]})
    return out


def conflict(current_version: int) -> HTTPException:
    return HTTPException(
        status.HTTP_409_CONFLICT,
        {
            "message": "This was changed elsewhere after you opened it. Reload to see the latest version.",
            "current_version": current_version,
        },
    )


@router.get("/projects/{project_id}/notes", response_model=list[NoteListItem])
def list_notes(project_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession) -> list[Note]:
    principal.require_scope(SCOPE_READ)
    project = get_project_for(db, principal, project_id)
    return list(
        db.scalars(select(Note).where(Note.project_id == project.id).order_by(Note.updated_at.desc()))
    )


@router.post("/projects/{project_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(
    project_id: uuid.UUID,
    body: NoteCreate,
    principal: CurrentPrincipal,
    db: DbSession,
    idempotency_key: IdemKey = None,
) -> JSONResponse:
    principal.require_scope(SCOPE_NOTES_WRITE)
    project = get_project_for(db, principal, project_id)
    key = idem.validate_key(idempotency_key)
    fp = idem.fingerprint(f"notes:{project.id}", body.model_dump())
    if (replayed := idem.replay(db, principal, key, fp)) is not None:
        return replayed
    note = Note(
        project_id=project.id,
        title=body.title,
        body=body.body,
        links=clean_links(db, project.id, body.links),
        last_edited_by=principal.label,
    )
    db.add(note)
    db.flush()
    payload = jsonable_encoder(NoteOut.model_validate(note))
    idem.remember(db, principal, key, fp, 201, payload)
    project.updated_at = utcnow()
    db.commit()
    return JSONResponse(payload, status_code=201)


@router.get("/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession) -> Note:
    principal.require_scope(SCOPE_READ)
    return get_note_for(db, principal, note_id)


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: uuid.UUID, body: NoteUpdate, principal: CurrentPrincipal, db: DbSession) -> Note:
    principal.require_scope(SCOPE_NOTES_WRITE)
    note = get_note_for(db, principal, note_id)
    changes = body.model_dump(exclude_unset=True, exclude={"base_version"})
    changes = {k: v for k, v in changes.items() if v is not None}
    if body.links is not None:
        changes["links"] = clean_links(db, note.project_id, body.links)
    if not changes:
        return note
    # Compare-and-set in SQL so two concurrent saves cannot both win.
    result = db.execute(
        update(Note)
        .where(Note.id == note.id, Note.version == body.base_version)
        .values(**changes, version=Note.version + 1, last_edited_by=principal.label, updated_at=utcnow())
    )
    if getattr(result, "rowcount", 0) != 1:
        db.rollback()
        db.refresh(note)
        raise conflict(note.version)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: uuid.UUID, principal: CurrentUser, db: DbSession) -> Response:
    note = get_note_for(db, principal, note_id)
    db.delete(note)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
