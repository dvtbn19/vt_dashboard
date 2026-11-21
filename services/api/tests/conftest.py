"""Test fixtures.

By default tests run against a throwaway SQLite file. Set TEST_DATABASE_URL to a PostgreSQL URL
(CI does this) to run the same suite on PostgreSQL. The schema is created with Alembic, so the
migrations are exercised too.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SECRET = "t" * 40


@pytest.fixture(scope="session")
def env(tmp_path_factory: pytest.TempPathFactory) -> Iterator[dict[str, str]]:
    tmp = tmp_path_factory.mktemp("lab")
    db_url = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp / 'test.db'}"
    # Analytics queries run against a separate database (SQLite file locally, the same Postgres in CI).
    analytics_url = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp / 'analytics.db'}"
    values = {
        "ENV": "test",
        "DATABASE_URL": db_url,
        "AUTH_MODE": "local",
        "LOCAL_JWT_SECRET": SECRET,
        "LOCAL_LOGIN_EMAIL": "owner@example.com",
        "LOCAL_LOGIN_PASSWORD": "correct horse battery staple",
        "LAB_ALLOWED_EMAILS": "owner@example.com,other@example.com",
        "STORAGE_BACKEND": "local",
        "LOCAL_STORAGE_DIR": str(tmp / "artifacts"),
        "STORAGE_SIGNING_SECRET": "s" * 40,
        "API_PUBLIC_URL": "http://testserver",
        "MAX_ARTIFACT_BYTES": str(2 * 1024 * 1024),
        "ANALYTICS_DATABASE_URL": analytics_url,
        "QUERY_MAX_ROWS": "50",
    }
    old = {k: os.environ.get(k) for k in values}
    os.environ.update(values)
    yield values
    for k, v in old.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


@pytest.fixture(scope="session")
def app(env: dict[str, str]):
    from alembic.config import Config

    from alembic import command
    from app.analytics import get_analytics_engine
    from app.config import get_settings
    from app.db import get_engine, get_sessionmaker
    from app.storage import get_storage

    for fn in (get_settings, get_engine, get_sessionmaker, get_storage, get_analytics_engine):
        fn.cache_clear()
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    cfg.set_main_option("sqlalchemy.url", env["DATABASE_URL"])
    if os.environ.get("TEST_DATABASE_URL"):
        command.downgrade(cfg, "base")  # start clean on a shared PostgreSQL database
    command.upgrade(cfg, "head")
    from app.main import create_app

    return create_app()


@pytest.fixture()
def client(app) -> TestClient:
    return TestClient(app)


def user_token(email: str = "owner@example.com") -> str:
    from app.auth import issue_local_token
    from app.config import get_settings

    return issue_local_token(get_settings(), email)


def auth(email: str = "owner@example.com") -> dict[str, str]:
    return {"Authorization": f"Bearer {user_token(email)}"}


@pytest.fixture()
def owner() -> dict[str, str]:
    return auth("owner@example.com")


@pytest.fixture()
def other() -> dict[str, str]:
    return auth("other@example.com")


@pytest.fixture()
def project(client: TestClient, owner: dict[str, str]) -> dict:
    slug = f"proj-{uuid.uuid4().hex[:8]}"
    r = client.post("/v1/projects", json={"name": "E-Commerce Sales Analysis", "slug": slug}, headers=owner)
    assert r.status_code == 201, r.text
    return r.json()


def make_token(client: TestClient, headers: dict[str, str], project_ids: list[str], scopes=None) -> str:
    body: dict = {"name": "test-agent", "project_ids": project_ids}
    if scopes is not None:
        body["scopes"] = scopes
    r = client.post("/v1/credentials", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
