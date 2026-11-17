from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator


def _utc(v: datetime | None) -> datetime | None:
    # SQLite drops tzinfo; every stored timestamp is UTC.
    if v is not None and v.tzinfo is None:
        return v.replace(tzinfo=UTC)
    return v


UtcDatetime = Annotated[datetime, AfterValidator(_utc)]
OptUtcDatetime = Annotated[datetime | None, AfterValidator(_utc)]

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ProjectStatus = Literal["idea", "active", "paused", "completed", "archived"]
Visibility = Literal["private", "public"]
Category = Literal["data-engineering", "data-science", "eda", "ml", "deep-learning", "ai-agent", "other"]
ArtifactKind = Literal["image", "csv", "markdown", "plotly"]
Scope = Literal["read", "runs:write", "artifacts:write"]
_DEFAULT_SCOPES: tuple[Scope, ...] = ("read", "runs:write", "artifacts:write")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def _clean_tags(v: list[str]) -> list[str]:
    out: list[str] = []
    for t in v:
        t = t.strip()[:40]
        if t and t not in out:
            out.append(t)
    return out[:20]


# --- projects -----------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=80)
    summary: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=50_000)
    category: Category = "eda"
    status: ProjectStatus = "active"
    visibility: Visibility = "private"
    tags: list[str] = Field(default_factory=list)
    repo_url: str | None = Field(default=None, max_length=500)

    _tags = field_validator("tags")(_clean_tags)

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str | None) -> str | None:
        if v is not None and not SLUG_RE.match(v):
            raise ValueError("slug must be lowercase letters, digits and single hyphens")
        return v

    @field_validator("repo_url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        if v and not v.startswith(("https://", "http://")):
            raise ValueError("repo_url must be an http(s) URL")
        return v or None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=50_000)
    category: Category | None = None
    status: ProjectStatus | None = None
    visibility: Visibility | None = None
    tags: list[str] | None = None
    repo_url: str | None = Field(default=None, max_length=500)

    @field_validator("tags")
    @classmethod
    def _tags(cls, v: list[str] | None) -> list[str] | None:
        return _clean_tags(v) if v is not None else None

    @field_validator("repo_url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        if v and not v.startswith(("https://", "http://")):
            raise ValueError("repo_url must be an http(s) URL")
        return v or None


class ProjectOut(ORM):
    id: uuid.UUID
    slug: str
    name: str
    summary: str
    description: str
    category: str
    status: str
    visibility: str
    tags: list[str]
    repo_url: str | None
    created_at: UtcDatetime
    updated_at: UtcDatetime


class ProjectListItem(ProjectOut):
    run_count: int = 0
    last_run_at: OptUtcDatetime = None
    last_run_status: str | None = None


class PublicProjectOut(ORM):
    slug: str
    name: str
    summary: str
    description: str
    category: str
    status: str
    tags: list[str]
    repo_url: str | None
    updated_at: UtcDatetime


# --- runs ---------------------------------------------------------------------


class RunCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    params: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    source: str = Field(default="sdk", max_length=40)
    git_commit: str | None = Field(default=None, max_length=64)
    dataset_version: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=10_000)

    _tags = field_validator("tags")(_clean_tags)

    @field_validator("params")
    @classmethod
    def _params_size(cls, v: dict[str, Any]) -> dict[str, Any]:
        import json

        if len(json.dumps(v, default=str)) > 32_000:
            raise ValueError("params too large (max 32 KB as JSON)")
        return v


class RunFinish(BaseModel):
    notes: str | None = Field(default=None, max_length=10_000)


class RunFail(BaseModel):
    error: str = Field(min_length=1, max_length=10_000)


class RunOut(ORM):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    status: str
    source: str
    params: dict[str, Any]
    tags: list[str]
    git_commit: str | None
    dataset_version: str | None
    notes: str | None
    error: str | None
    started_at: UtcDatetime
    finished_at: OptUtcDatetime
    created_at: UtcDatetime
    updated_at: UtcDatetime
    created_by: str | None = None


class RunListItem(RunOut):
    metric_count: int = 0
    artifact_count: int = 0


class MetricIn(BaseModel):
    key: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9_.\-/ ]+$")
    value: float
    step: int | None = Field(default=None, ge=0)

    @field_validator("value")
    @classmethod
    def _finite(cls, v: float) -> float:
        import math

        if not math.isfinite(v):
            raise ValueError("metric value must be finite")
        return v


class MetricsIn(BaseModel):
    metrics: list[MetricIn] = Field(min_length=1, max_length=1000)


class MetricOut(ORM):
    key: str
    value: float
    step: int | None
    recorded_at: UtcDatetime


class MetricsAccepted(BaseModel):
    accepted: int


# --- artifacts ------------------------------------------------------------------


class ArtifactInitiate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(max_length=100)
    size_bytes: int = Field(gt=0)
    kind: ArtifactKind | None = None
    checksum_sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    description: str | None = Field(default=None, max_length=1000)


class ArtifactOut(ORM):
    id: uuid.UUID
    run_id: uuid.UUID
    name: str
    kind: str
    mime_type: str
    size_bytes: int
    checksum_sha256: str | None
    status: str
    description: str | None
    failure_reason: str | None
    created_at: UtcDatetime
    finalized_at: OptUtcDatetime


class UploadInstructions(BaseModel):
    method: str
    url: str
    headers: dict[str, str]
    expires_at: datetime


class ArtifactInitiated(BaseModel):
    artifact: ArtifactOut
    upload: UploadInstructions


class DownloadLink(BaseModel):
    url: str
    expires_at: datetime
    filename: str
    mime_type: str


class ArtifactPreview(BaseModel):
    kind: str
    truncated: bool = False
    # csv
    columns: list[str] | None = None
    rows: list[list[str]] | None = None
    # markdown
    text: str | None = None
    # plotly
    figure: dict[str, Any] | None = None
    # image
    url: str | None = None


class RunDetail(RunOut):
    project: ProjectOut
    metrics: list[MetricOut]
    artifacts: list[ArtifactOut]


# --- credentials ----------------------------------------------------------------


class CredentialCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    project_ids: list[str] = Field(min_length=1, description="Project UUIDs, or ['*'] for all your projects")
    scopes: list[Scope] = Field(default_factory=lambda: list(_DEFAULT_SCOPES), min_length=1)
    expires_in_days: int | None = Field(default=90, ge=1, le=365)


class CredentialOut(ORM):
    id: uuid.UUID
    name: str
    token_prefix: str
    scopes: list[str]
    project_ids: list[str]
    created_at: UtcDatetime
    expires_at: OptUtcDatetime
    last_used_at: OptUtcDatetime
    revoked_at: OptUtcDatetime


class CredentialCreated(CredentialOut):
    token: str = Field(description="Shown once. Store it securely; it cannot be retrieved again.")


# --- misc -----------------------------------------------------------------------


class MeOut(BaseModel):
    kind: str
    owner_id: uuid.UUID
    email: str | None
    scopes: list[str]


class OverviewOut(BaseModel):
    project_count: int
    run_count: int
    running_count: int
    failed_count: int
    artifact_count: int
    recent_runs: list[RunListItem]
    project_names: dict[str, str]


class LocalLogin(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
