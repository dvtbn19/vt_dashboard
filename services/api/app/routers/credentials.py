from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.auth import ALL_PROJECTS, CurrentUser, DbSession, new_agent_token
from app.models import AgentCredential, Project, utcnow
from app.schemas import CredentialCreate, CredentialCreated, CredentialOut

router = APIRouter(prefix="/v1/credentials", tags=["credentials"])


@router.get("", response_model=list[CredentialOut])
def list_credentials(principal: CurrentUser, db: DbSession) -> list[AgentCredential]:
    return list(
        db.scalars(
            select(AgentCredential)
            .where(AgentCredential.owner_id == principal.owner_id)
            .order_by(AgentCredential.created_at.desc())
        )
    )


@router.post("", response_model=CredentialCreated, status_code=status.HTTP_201_CREATED)
def create_credential(body: CredentialCreate, principal: CurrentUser, db: DbSession) -> CredentialCreated:
    project_ids: list[str] = []
    if ALL_PROJECTS in body.project_ids:
        project_ids = [ALL_PROJECTS]
    else:
        for raw in dict.fromkeys(body.project_ids):
            try:
                pid = uuid.UUID(raw)
            except ValueError as exc:
                raise HTTPException(422, f"Invalid project id '{raw}'") from exc
            project = db.get(Project, pid)
            if project is None or project.owner_id != principal.owner_id:
                raise HTTPException(status.HTTP_404_NOT_FOUND, f"Project {raw} not found")
            project_ids.append(str(pid))
    token, prefix, token_hash = new_agent_token()
    cred = AgentCredential(
        owner_id=principal.owner_id,
        name=body.name,
        token_prefix=prefix,
        token_hash=token_hash,
        scopes=sorted(set(body.scopes)),
        project_ids=project_ids,
        expires_at=utcnow() + timedelta(days=body.expires_in_days) if body.expires_in_days else None,
    )
    db.add(cred)
    db.commit()
    return CredentialCreated(**CredentialOut.model_validate(cred).model_dump(), token=token)


@router.post("/{credential_id}/revoke", response_model=CredentialOut)
def revoke_credential(credential_id: uuid.UUID, principal: CurrentUser, db: DbSession) -> AgentCredential:
    cred = db.get(AgentCredential, credential_id)
    if cred is None or cred.owner_id != principal.owner_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Credential not found")
    if cred.revoked_at is None:
        cred.revoked_at = utcnow()
        db.commit()
    return cred
