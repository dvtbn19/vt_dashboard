from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import idempotency as idem
from app.auth import SCOPE_READ, SCOPE_RUNS_WRITE, CurrentPrincipal, CurrentUser, DbSession, Principal
from app.models import Artifact, Metric, Project, Run, utcnow
from app.routers.projects import get_project_for
from app.schemas import (
    ArtifactOut,
    MetricOut,
    MetricsAccepted,
    MetricsIn,
    OverviewOut,
    ProjectOut,
    RunCreate,
    RunDetail,
    RunFail,
    RunFinish,
    RunOut,
)
from app.serializers import run_list_items, run_out

router = APIRouter(prefix="/v1", tags=["runs"])
IdemKey = Annotated[str | None, Header(alias="Idempotency-Key")]


def get_run_for(db: Session, principal: Principal, run_id: uuid.UUID) -> Run:
    run = db.get(Run, run_id)
    if run is None or not principal.can_access_project(run.project):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    return run


@router.post("/projects/{project_id}/runs", response_model=RunOut, status_code=status.HTTP_201_CREATED)
def create_run(
    project_id: uuid.UUID,
    body: RunCreate,
    principal: CurrentPrincipal,
    db: DbSession,
    idempotency_key: IdemKey = None,
) -> JSONResponse:
    principal.require_scope(SCOPE_RUNS_WRITE)
    project = get_project_for(db, principal, project_id)
    key = idem.validate_key(idempotency_key)
    fp = idem.fingerprint(f"runs:{project.id}", body.model_dump())
    if (replayed := idem.replay(db, principal, key, fp)) is not None:
        return replayed
    run = Run(
        project_id=project.id,
        **body.model_dump(),
        created_by_user_id=principal.user.id if principal.user else None,
        created_by_credential_id=principal.credential.id if principal.credential else None,
    )
    db.add(run)
    db.flush()
    payload = jsonable_encoder(run_out(db, run))
    idem.remember(db, principal, key, fp, 201, payload)
    project.updated_at = utcnow()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if (replayed := idem.replay(db, principal, key, fp)) is not None:
            return replayed
        raise
    return JSONResponse(payload, status_code=201)


@router.get("/runs/{run_id}", response_model=RunDetail)
def get_run(run_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession) -> RunDetail:
    principal.require_scope(SCOPE_READ)
    run = get_run_for(db, principal, run_id)
    base = run_out(db, run)
    return RunDetail(
        **base.model_dump(),
        project=ProjectOut.model_validate(run.project),
        metrics=[MetricOut.model_validate(m) for m in run.metrics],
        artifacts=[ArtifactOut.model_validate(a) for a in run.artifacts],
    )


@router.post("/runs/{run_id}/metrics", response_model=MetricsAccepted, status_code=status.HTTP_201_CREATED)
def log_metrics(
    run_id: uuid.UUID,
    body: MetricsIn,
    principal: CurrentPrincipal,
    db: DbSession,
    idempotency_key: IdemKey = None,
) -> JSONResponse:
    principal.require_scope(SCOPE_RUNS_WRITE)
    run = get_run_for(db, principal, run_id)
    if run.status != "running":
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Run is {run.status}; metrics can only be logged while running"
        )
    key = idem.validate_key(idempotency_key)
    fp = idem.fingerprint(f"metrics:{run.id}", body.model_dump())
    if (replayed := idem.replay(db, principal, key, fp)) is not None:
        return replayed
    now = utcnow()
    db.add_all(
        Metric(run_id=run.id, key=m.key, value=m.value, step=m.step, recorded_at=now) for m in body.metrics
    )
    payload = {"accepted": len(body.metrics)}
    idem.remember(db, principal, key, fp, 201, payload)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if (replayed := idem.replay(db, principal, key, fp)) is not None:
            return replayed
        raise
    return JSONResponse(payload, status_code=201)


def _finish(db: Session, run: Run, new_status: str) -> None:
    if run.status == new_status:
        return  # idempotent: finishing twice with the same outcome is a no-op
    if run.status != "running":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Run is already {run.status}")
    run.status = new_status
    run.finished_at = utcnow()


@router.post("/runs/{run_id}/complete", response_model=RunOut)
def complete_run(
    run_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession, body: RunFinish | None = None
) -> RunOut:
    principal.require_scope(SCOPE_RUNS_WRITE)
    run = get_run_for(db, principal, run_id)
    was_running = run.status == "running"
    _finish(db, run, "completed")
    if was_running and body and body.notes:
        run.notes = body.notes
    db.commit()
    return run_out(db, run)


@router.post("/runs/{run_id}/fail", response_model=RunOut)
def fail_run(run_id: uuid.UUID, body: RunFail, principal: CurrentPrincipal, db: DbSession) -> RunOut:
    principal.require_scope(SCOPE_RUNS_WRITE)
    run = get_run_for(db, principal, run_id)
    was_running = run.status == "running"
    _finish(db, run, "failed")
    if was_running:
        run.error = body.error
    db.commit()
    return run_out(db, run)


@router.get("/overview", response_model=OverviewOut, tags=["lab"])
def overview(principal: CurrentUser, db: DbSession) -> OverviewOut:
    owner = principal.owner_id
    projects = dict(db.execute(select(Project.id, Project.name).where(Project.owner_id == owner)).all())
    ids = list(projects)

    def count_runs(*conds) -> int:
        if not ids:
            return 0
        return db.scalar(select(func.count(Run.id)).where(Run.project_id.in_(ids), *conds)) or 0

    artifact_count = 0
    if ids:
        artifact_count = (
            db.scalar(
                select(func.count(Artifact.id))
                .join(Run, Run.id == Artifact.run_id)
                .where(Run.project_id.in_(ids), Artifact.status == "ready")
            )
            or 0
        )
    recent = (
        list(db.scalars(select(Run).where(Run.project_id.in_(ids)).order_by(Run.started_at.desc()).limit(8)))
        if ids
        else []
    )
    return OverviewOut(
        project_count=len(ids),
        run_count=count_runs(),
        running_count=count_runs(Run.status == "running"),
        failed_count=count_runs(Run.status == "failed"),
        artifact_count=artifact_count,
        recent_runs=run_list_items(db, recent),
        project_names={str(k): v for k, v in projects.items()},
    )
