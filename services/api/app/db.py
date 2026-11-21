from __future__ import annotations

import os
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def serverless() -> bool:
    return bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


def make_engine(url: str, pool: str = "auto") -> Engine:
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}}
    else:
        # No server-side prepared statements: they break behind Supabase's transaction pooler (6543).
        kwargs["connect_args"] = {"prepare_threshold": None} if "+psycopg" in url else {}
        if pool == "none" or (pool == "auto" and serverless()):
            kwargs["poolclass"] = NullPool
        else:
            kwargs.update(pool_pre_ping=True, pool_size=3, max_overflow=2, pool_recycle=300)
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _rec):  # pragma: no cover - trivial
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    return make_engine(settings.database_url, settings.database_pool)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = get_sessionmaker()()
    try:
        yield db
    finally:
        db.close()
