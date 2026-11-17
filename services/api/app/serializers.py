from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AgentCredential, Artifact, Metric, Run, User
from app.schemas import RunListItem, RunOut


def _creator(db: Session, run: Run) -> str | None:
    if run.created_by_credential_id:
        cred = db.get(AgentCredential, run.created_by_credential_id)
        return f"agent:{cred.name}" if cred else "agent"
    if run.created_by_user_id:
        user = db.get(User, run.created_by_user_id)
        return user.email if user else "user"
    return None


def run_out(db: Session, run: Run) -> RunOut:
    out = RunOut.model_validate(run)
    out.created_by = _creator(db, run)
    return out


def run_list_items(db: Session, runs: list[Run]) -> list[RunListItem]:
    if not runs:
        return []
    ids: list[uuid.UUID] = [r.id for r in runs]
    m_counts = dict(
        db.execute(
            select(Metric.run_id, func.count(Metric.id)).where(Metric.run_id.in_(ids)).group_by(Metric.run_id)
        ).all()
    )
    a_counts = dict(
        db.execute(
            select(Artifact.run_id, func.count(Artifact.id))
            .where(Artifact.run_id.in_(ids), Artifact.status == "ready")
            .group_by(Artifact.run_id)
        ).all()
    )
    out = []
    for r in runs:
        item = RunListItem.model_validate(r)
        item.created_by = _creator(db, r)
        item.metric_count = m_counts.get(r.id, 0)
        item.artifact_count = a_counts.get(r.id, 0)
        out.append(item)
    return out
