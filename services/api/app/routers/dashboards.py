"""Which run a project's dashboard shows."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.auth import SCOPE_READ, SCOPE_RUNS_WRITE, CurrentPrincipal, DbSession
from app.models import Dashboard, Run
from app.routers.projects import get_project_for
from app.schemas import DashboardOut, DashboardUpdate

router = APIRouter(prefix="/v1", tags=["dashboards"])


def _out(project_id: uuid.UUID, d: Dashboard | None) -> DashboardOut:
    if d is None:
        return DashboardOut(project_id=project_id, run_id=None)
    return DashboardOut(
        project_id=project_id, run_id=d.run_id, updated_by=d.updated_by, updated_at=d.updated_at
    )


@router.get("/projects/{project_id}/dashboard", response_model=DashboardOut)
def get_dashboard(project_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession) -> DashboardOut:
    principal.require_scope(SCOPE_READ)
    project = get_project_for(db, principal, project_id)
    return _out(project.id, db.get(Dashboard, project.id))


@router.put("/projects/{project_id}/dashboard", response_model=DashboardOut)
def set_dashboard(
    project_id: uuid.UUID, body: DashboardUpdate, principal: CurrentPrincipal, db: DbSession
) -> DashboardOut:
    """Show this run on the project's dashboard (an agent can pin the run it just published)."""
    principal.require_scope(SCOPE_RUNS_WRITE)
    project = get_project_for(db, principal, project_id)
    if body.run_id is not None:
        run = db.get(Run, body.run_id)
        if run is None or run.project_id != project.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That run is not in this project")
    d = db.get(Dashboard, project.id)
    if d is None:
        db.add(Dashboard(project_id=project.id, run_id=body.run_id, updated_by=principal.label))
        try:
            db.flush()
        except IntegrityError:  # created concurrently: last write wins
            db.rollback()
            d = db.get(Dashboard, project.id)
    if d is not None:
        d.run_id = body.run_id
        d.updated_by = principal.label
    db.commit()
    return _out(project.id, db.get(Dashboard, project.id))
