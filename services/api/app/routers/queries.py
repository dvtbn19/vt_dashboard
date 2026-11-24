"""Saved SQL queries per project, and running read-only SQL against the analytics database."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import analytics
from app import idempotency as idem
from app.auth import (
    SCOPE_QUERIES_WRITE,
    SCOPE_READ,
    AppSettings,
    CurrentPrincipal,
    CurrentUser,
    DbSession,
    Principal,
)
from app.models import Note, Project, SavedQuery, utcnow
from app.routers.notes import conflict
from app.routers.projects import get_project_for
from app.schemas import (
    QueryCreate,
    QueryEngineStatus,
    QueryOut,
    QueryResult,
    QueryRun,
    QueryUpdate,
)

router = APIRouter(prefix="/v1", tags=["queries"])
IdemKey = Annotated[str | None, Header(alias="Idempotency-Key")]


def get_query_for(db: Session, principal: Principal, query_id: uuid.UUID) -> SavedQuery:
    q = db.get(SavedQuery, query_id)
    if q is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Query not found")
    project = db.get(Project, q.project_id)
    if project is None or not principal.can_access_project(project):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Query not found")
    return q


def _execute(sql: str, max_rows: int) -> QueryResult:
    try:
        return QueryResult(**analytics.run_readonly(sql, max_rows))
    except analytics.QueryNotConfigured as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Running queries is not set up: ANALYTICS_DATABASE_URL is empty on the API.",
        ) from exc
    except analytics.QueryError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/queries/engine", response_model=QueryEngineStatus)
def engine_status(principal: CurrentUser, settings: AppSettings) -> QueryEngineStatus:
    return QueryEngineStatus(
        configured=bool(settings.analytics_database_url.strip()),
        timeout_seconds=settings.query_timeout_seconds,
        max_rows=settings.query_max_rows,
    )


@router.post("/queries/run", response_model=QueryResult)
def run_sql(body: QueryRun, principal: CurrentUser) -> QueryResult:
    """Run one read-only statement. Signed-in owner only; agent tokens cannot run SQL."""
    return _execute(body.sql, body.max_rows)


@router.get("/projects/{project_id}/queries", response_model=list[QueryOut])
def list_queries(project_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession) -> list[SavedQuery]:
    principal.require_scope(SCOPE_READ)
    project = get_project_for(db, principal, project_id)
    return list(
        db.scalars(select(SavedQuery).where(SavedQuery.project_id == project.id).order_by(SavedQuery.name))
    )


@router.post("/projects/{project_id}/queries", response_model=QueryOut, status_code=status.HTTP_201_CREATED)
def create_query(
    project_id: uuid.UUID,
    body: QueryCreate,
    principal: CurrentPrincipal,
    db: DbSession,
    idempotency_key: IdemKey = None,
) -> JSONResponse:
    principal.require_scope(SCOPE_QUERIES_WRITE)
    project = get_project_for(db, principal, project_id)
    key = idem.validate_key(idempotency_key)
    fp = idem.fingerprint(f"queries:{project.id}", body.model_dump())
    if (replayed := idem.replay(db, principal, key, fp)) is not None:
        return replayed
    q = SavedQuery(
        project_id=project.id,
        name=body.name,
        description=body.description,
        sql=body.sql,
        chart=body.chart.model_dump() if body.chart else None,
        last_edited_by=principal.label,
    )
    db.add(q)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"A query named '{body.name}' already exists") from exc
    payload = jsonable_encoder(QueryOut.model_validate(q))
    idem.remember(db, principal, key, fp, 201, payload)
    project.updated_at = utcnow()
    db.commit()
    return JSONResponse(payload, status_code=201)


@router.get("/queries/{query_id}", response_model=QueryOut)
def get_query(query_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession) -> SavedQuery:
    principal.require_scope(SCOPE_READ)
    return get_query_for(db, principal, query_id)


@router.patch("/queries/{query_id}", response_model=QueryOut)
def update_query(
    query_id: uuid.UUID, body: QueryUpdate, principal: CurrentPrincipal, db: DbSession
) -> SavedQuery:
    principal.require_scope(SCOPE_QUERIES_WRITE)
    q = get_query_for(db, principal, query_id)
    changes = body.model_dump(exclude_unset=True, exclude={"base_version"})
    # `chart: null` clears the chart; other fields are only changed when given a value.
    changes = {k: v for k, v in changes.items() if v is not None or k == "chart"}
    if not changes:
        return q
    try:
        result = db.execute(
            update(SavedQuery)
            .where(SavedQuery.id == q.id, SavedQuery.version == body.base_version)
            .values(
                **changes, version=SavedQuery.version + 1, last_edited_by=principal.label, updated_at=utcnow()
            )
        )
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"A query named '{changes.get('name')}' already exists"
        ) from exc
    if getattr(result, "rowcount", 0) != 1:
        db.rollback()
        db.refresh(q)
        raise conflict(q.version)
    db.commit()
    db.refresh(q)
    return q


@router.delete("/queries/{query_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_query(query_id: uuid.UUID, principal: CurrentUser, db: DbSession) -> Response:
    q = get_query_for(db, principal, query_id)
    # Drop links to it from the project's notes (without bumping their version: content is unchanged).
    for note in db.scalars(select(Note).where(Note.project_id == q.project_id)):
        kept = [link for link in note.links or [] if link.get("query_id") != str(q.id)]
        if len(kept) != len(note.links or []):
            note.links = kept
    db.delete(q)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/queries/{query_id}/run", response_model=QueryResult)
def run_saved(
    query_id: uuid.UUID,
    principal: CurrentUser,
    db: DbSession,
    max_rows: int = Query(default=1000, ge=1, le=5000),
) -> QueryResult:
    q = get_query_for(db, principal, query_id)
    # A saved query may hold several statements (the editor runs one at a time); the saved
    # query's result, as used by charts and the dashboard, is its first statement.
    statements = analytics.split_statements(q.sql)
    sql = statements[0] if statements else q.sql
    db.close()  # do not hold a metadata DB connection while the analytics query runs
    return _execute(sql, max_rows)
