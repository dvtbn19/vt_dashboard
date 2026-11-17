from __future__ import annotations

import re
import secrets
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import ALL_PROJECTS, SCOPE_READ, CurrentPrincipal, CurrentUser, DbSession, Principal
from app.models import Project, Run
from app.schemas import (
    ProjectCreate,
    ProjectListItem,
    ProjectOut,
    ProjectUpdate,
    PublicProjectOut,
    RunListItem,
)
from app.serializers import run_list_items

router = APIRouter(prefix="/v1", tags=["projects"])


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60].strip("-")
    return slug or "project"


def get_project_for(db: Session, principal: Principal, project_id: uuid.UUID) -> Project:
    """Load a project the caller may access. Others' projects look like 404 (no existence leak)."""
    project = db.get(Project, project_id)
    if project is None or not principal.can_access_project(project):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.get("/projects", response_model=list[ProjectListItem])
def list_projects(
    principal: CurrentPrincipal, db: DbSession, slug: str | None = Query(default=None, max_length=80)
) -> list[ProjectListItem]:
    principal.require_scope(SCOPE_READ)
    stmt = select(Project).where(Project.owner_id == principal.owner_id)
    if slug:
        stmt = stmt.where(Project.slug == slug)
    if principal.kind == "agent":
        assert principal.credential is not None
        allowed = principal.credential.project_ids
        if ALL_PROJECTS not in allowed:
            ids = [uuid.UUID(p) for p in allowed]
            stmt = stmt.where(Project.id.in_(ids))
    projects = list(db.scalars(stmt.order_by(Project.updated_at.desc())))
    if not projects:
        return []
    ids = [p.id for p in projects]
    stats = {
        row.project_id: row
        for row in db.execute(
            select(Run.project_id, func.count(Run.id).label("n"), func.max(Run.started_at).label("last"))
            .where(Run.project_id.in_(ids))
            .group_by(Run.project_id)
        )
    }
    last_status: dict[uuid.UUID, str] = {}
    for pid in ids:
        st = db.scalar(
            select(Run.status).where(Run.project_id == pid).order_by(Run.started_at.desc()).limit(1)
        )
        if st:
            last_status[pid] = st
    out = []
    for p in projects:
        item = ProjectListItem.model_validate(p)
        if p.id in stats:
            item.run_count = stats[p.id].n
            item.last_run_at = stats[p.id].last
            item.last_run_status = last_status.get(p.id)
        out.append(item)
    return out


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, principal: CurrentUser, db: DbSession) -> Project:
    slug = body.slug or slugify(body.name)
    if body.slug is None and db.scalar(select(Project.id).where(Project.slug == slug)):
        slug = f"{slug[:70]}-{secrets.token_hex(3)}"
    project = Project(owner_id=principal.owner_id, **body.model_dump(exclude={"slug"}), slug=slug)
    db.add(project)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"Slug '{slug}' is already taken") from exc
    return project


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: uuid.UUID, principal: CurrentPrincipal, db: DbSession) -> Project:
    principal.require_scope(SCOPE_READ)
    return get_project_for(db, principal, project_id)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID, body: ProjectUpdate, principal: CurrentUser, db: DbSession
) -> Project:
    project = get_project_for(db, principal, project_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None and field not in ("repo_url",):
            continue
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects/{project_id}/runs", response_model=list[RunListItem])
def list_runs(
    project_id: uuid.UUID,
    principal: CurrentPrincipal,
    db: DbSession,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[RunListItem]:
    principal.require_scope(SCOPE_READ)
    project = get_project_for(db, principal, project_id)
    runs = list(
        db.scalars(
            select(Run).where(Run.project_id == project.id).order_by(Run.started_at.desc()).limit(limit)
        )
    )
    return run_list_items(db, runs)


@router.get("/public/projects", response_model=list[PublicProjectOut], tags=["public"])
def public_projects(db: DbSession) -> list[Project]:
    """Unauthenticated: only projects explicitly marked `public`."""
    return list(
        db.scalars(select(Project).where(Project.visibility == "public").order_by(Project.updated_at.desc()))
    )


@router.get("/public/projects/{slug}", response_model=PublicProjectOut, tags=["public"])
def public_project(slug: str, db: DbSession) -> Project:
    project = db.scalar(select(Project).where(Project.slug == slug, Project.visibility == "public"))
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project
