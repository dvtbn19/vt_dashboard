"""The workspace notebook of a project: ordered SQL cells (saved queries) and Markdown cells."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import SCOPE_QUERIES_WRITE, SCOPE_READ, CurrentPrincipal, DbSession
from app.models import Notebook, SavedQuery, utcnow
from app.routers.notes import conflict
from app.routers.projects import get_project_for
from app.schemas import MarkdownCell, NotebookCell, NotebookOut, NotebookUpdate, SqlCell

router = APIRouter(prefix="/v1", tags=["notebooks"])


def clean_cells(db: Session, project_id: uuid.UUID, cells: list[NotebookCell]) -> list[dict[str, Any]]:
    """Keep SQL cells of this project's existing queries (each once) and Markdown cells (unique ids).

    Unknown query ids are dropped, not rejected: a query deleted while the notebook was open must not
    make the next save fail.
    """
    ids = {c.query_id for c in cells if isinstance(c, SqlCell)}
    valid: set[uuid.UUID] = set()
    if ids:
        valid = set(
            db.scalars(
                select(SavedQuery.id).where(SavedQuery.project_id == project_id, SavedQuery.id.in_(ids))
            )
        )
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for c in cells:
        if isinstance(c, SqlCell):
            key = f"sql:{c.query_id}"
            if c.query_id in valid and key not in seen:
                out.append({"type": "sql", "query_id": str(c.query_id)})
                seen.add(key)
        elif isinstance(c, MarkdownCell):
            key = f"md:{c.id}"
            if key not in seen:
                out.append({"type": "markdown", "id": c.id, "text": c.text})
                seen.add(key)
    return out


def _out(project_id: uuid.UUID, nb: Notebook | None, db: Session) -> NotebookOut:
    if nb is None:
        return NotebookOut(project_id=project_id, cells=[], version=0)
    db.refresh(nb)
    # Read back through the cleaner so deleted queries disappear from the order.
    raw = NotebookUpdate.model_validate({"base_version": 0, "cells": nb.cells or []}).cells
    cleaned = clean_cells(db, project_id, raw)
    return NotebookOut(
        project_id=project_id,
        cells=NotebookUpdate.model_validate({"base_version": 0, "cells": cleaned}).cells,
        version=nb.version,
        last_edited_by=nb.last_edited_by,
        updated_at=nb.updated_at,
    )


@router.get("/projects/{project_id}/notebook", response_model=NotebookOut)
def get_notebook(project_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession) -> NotebookOut:
    principal.require_scope(SCOPE_READ)
    project = get_project_for(db, principal, project_id)
    return _out(project.id, db.get(Notebook, project.id), db)


@router.put("/projects/{project_id}/notebook", response_model=NotebookOut)
def save_notebook(
    project_id: uuid.UUID, body: NotebookUpdate, principal: CurrentPrincipal, db: DbSession
) -> NotebookOut:
    """Replace the cell order. Send the version you loaded (0 for a project without a notebook); 409 if it changed."""
    principal.require_scope(SCOPE_QUERIES_WRITE)
    project = get_project_for(db, principal, project_id)
    cells = clean_cells(db, project.id, body.cells)
    nb = db.get(Notebook, project.id)
    if nb is None:
        if body.base_version != 0:
            raise conflict(0)
        db.add(Notebook(project_id=project.id, cells=cells, version=1, last_edited_by=principal.label))
        try:
            db.flush()
        except IntegrityError:  # created by someone else in the meantime
            db.rollback()
            current = db.get(Notebook, project.id)
            raise conflict(current.version if current else 0) from None
    else:
        result = db.execute(
            update(Notebook)
            .where(Notebook.project_id == project.id, Notebook.version == body.base_version)
            .values(
                cells=cells, version=Notebook.version + 1, last_edited_by=principal.label, updated_at=utcnow()
            )
        )
        if getattr(result, "rowcount", 0) != 1:
            db.rollback()
            db.refresh(nb)
            raise conflict(nb.version)
    db.commit()
    return _out(project.id, db.get(Notebook, project.id), db)
