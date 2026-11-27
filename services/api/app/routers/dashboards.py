"""Which run a project's dashboard shows, and publishing it."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth import SCOPE_READ, SCOPE_RUNS_WRITE, AppSettings, CurrentPrincipal, DbSession
from app.models import Artifact, Dashboard, Project, Run, utcnow
from app.routers.artifacts import StorageDep, build_preview
from app.routers.projects import get_project_for
from app.schemas import (
    DashboardOut,
    DashboardUpdate,
    MetricOut,
    PublicDashboardArtifact,
    PublicDashboardOut,
    PublicDashboardProject,
    PublicDashboardRun,
)

router = APIRouter(prefix="/v1", tags=["dashboards"])
log = logging.getLogger("vtcons.api")


def _out(project_id: uuid.UUID, d: Dashboard | None) -> DashboardOut:
    if d is None:
        return DashboardOut(project_id=project_id, run_id=None)
    return DashboardOut(
        project_id=project_id,
        run_id=d.run_id,
        is_public=bool(d.is_public and d.run_id),
        published_at=d.published_at if d.is_public else None,
        updated_by=d.updated_by,
        updated_at=d.updated_at,
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
    """Pin the run the dashboard shows (an agent can pin the run it just published).

    Publishing is for signed-in users only, and a published dashboard can only be changed by them:
    an agent cannot alter what the public sees.
    """
    principal.require_scope(SCOPE_RUNS_WRITE)
    project = get_project_for(db, principal, project_id)
    if body.run_id is not None:
        run = db.get(Run, body.run_id)
        if run is None or run.project_id != project.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That run is not in this project")
    d = db.get(Dashboard, project.id)
    if principal.kind != "user":
        if body.is_public is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a signed-in user can publish a dashboard")
        if d is not None and d.is_public:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "This dashboard is published; unpublish it in the Lab to change it"
            )
    if body.is_public is not None:
        publish = body.is_public
    else:  # keep it published while a run stays pinned; unpinning unpublishes
        publish = bool(d and d.is_public) and body.run_id is not None
    if publish and body.run_id is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Pin a run before publishing")
    if d is None:
        d = Dashboard(project_id=project.id)
        db.add(d)
        try:
            db.flush()
        except IntegrityError:  # created concurrently: last write wins
            db.rollback()
            d = db.get(Dashboard, project.id)
            assert d is not None
    if publish and not (d.is_public and d.run_id == body.run_id):
        d.published_at = utcnow()
    d.run_id = body.run_id
    d.is_public = publish
    d.updated_by = principal.label
    db.commit()
    return _out(project.id, db.get(Dashboard, project.id))


@router.get("/public/dashboards/{slug}", response_model=PublicDashboardOut, tags=["public"])
def public_dashboard(
    slug: str, db: DbSession, settings: AppSettings, storage: StorageDep
) -> PublicDashboardOut:
    """Unauthenticated: a dashboard its owner published. 404 for anything else (no existence leak)."""
    row = db.execute(
        select(Project, Dashboard)
        .join(Dashboard, Dashboard.project_id == Project.id)
        .where(Project.slug == slug, Dashboard.is_public.is_(True), Dashboard.run_id.is_not(None))
    ).first()
    run = db.get(Run, row[1].run_id) if row else None
    if row is None or run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dashboard not found")
    project, dash = row
    artifacts: list[PublicDashboardArtifact] = []
    ready: list[Artifact] = [a for a in run.artifacts if a.status == "ready"]
    for a in ready:
        item = PublicDashboardArtifact(id=a.id, name=a.name, kind=a.kind, description=a.description)
        try:
            item.preview = build_preview(a, settings, storage)
        except HTTPException as exc:
            item.error = str(exc.detail)
        except Exception:  # one unreadable file must not hide the dashboard
            log.exception("Public dashboard preview failed for artifact %s", a.id)
            item.error = "Preview unavailable"
        artifacts.append(item)
    return PublicDashboardOut(
        project=PublicDashboardProject(slug=project.slug, name=project.name, category=project.category),
        run=PublicDashboardRun(
            name=run.name,
            status=run.status,
            params=run.params,
            tags=run.tags,
            started_at=run.started_at,
            finished_at=run.finished_at,
        ),
        metrics=[MetricOut.model_validate(m, from_attributes=True) for m in run.metrics],
        artifacts=artifacts,
        published_at=dash.published_at,
    )
