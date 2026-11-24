"""Run owner-supplied, read-only SQL against a separate analytics database.

Defence in depth (the first layer is the one that matters):
1. ANALYTICS_DATABASE_URL must use a database role that can only SELECT (e.g. Supabase `team_ro`).
2. Every query runs in a READ ONLY transaction with a statement timeout, and is always rolled back.
3. Exactly one SELECT-like statement: the SQL is wrapped as `SELECT * FROM (<sql>) AS q LIMIT n`,
   so anything that is not a single query (`COMMIT; DROP ...`, `INSERT ...`, `SET ...`) is a syntax
   error, whatever protocol the driver uses. The LIMIT also keeps the server from producing rows we
   would throw away.
4. Results are capped in rows and cell size; nothing is stored.
Only signed-in users (never agent tokens) may run queries.
"""

from __future__ import annotations

import datetime as dt
import decimal
import math
import re
import time
import uuid
from functools import lru_cache
from typing import Any

from sqlalchemy import Engine, create_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings

MAX_CELL_CHARS = 2000


class QueryError(Exception):
    """A problem the user can fix (syntax error, timeout, permission denied...)."""


class QueryNotConfigured(Exception):
    pass


@lru_cache
def get_analytics_engine() -> Engine | None:
    url = get_settings().analytics_database_url.strip()
    if not url:
        return None
    if url.startswith("postgresql://") or url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url.split("://", 1)[1]
    kwargs: dict[str, Any] = {"poolclass": NullPool}
    if url.startswith("postgresql"):
        kwargs["connect_args"] = {"connect_timeout": 10, "application_name": "vtcons-lab-query"}
    return create_engine(url, **kwargs)


def _cell(v: Any) -> Any:
    if v is None or isinstance(v, bool | int | str):
        if isinstance(v, str) and len(v) > MAX_CELL_CHARS:
            return v[:MAX_CELL_CHARS] + "…"
        return v
    if isinstance(v, float):
        return v if math.isfinite(v) else None
    if isinstance(v, decimal.Decimal):
        f = float(v)
        return f if math.isfinite(f) else None
    if isinstance(v, dt.datetime | dt.date | dt.time):
        return v.isoformat()
    if isinstance(v, dt.timedelta):
        return v.total_seconds()
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, bytes | bytearray | memoryview):
        return f"<{len(bytes(v))} bytes>"
    if isinstance(v, list | tuple):
        return [_cell(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _cell(x) for k, x in v.items()}
    s = str(v)
    return s if len(s) <= MAX_CELL_CHARS else s[:MAX_CELL_CHARS] + "…"


def _message(exc: Exception) -> str:
    diag = getattr(exc, "diag", None)
    primary = getattr(diag, "message_primary", None) if diag else None
    first_line = (str(exc).splitlines() or [""])[0]
    text = primary or first_line or exc.__class__.__name__
    hint = getattr(diag, "message_hint", None) if diag else None
    if primary and hint:
        text += f" (hint: {hint})"
    return text[:500]


_TRAILING_COMMENT = re.compile(r"--[^\n']*$")


def strip_trailing(sql: str) -> str:
    """Drop trailing whitespace, semicolons and `--` comments (`select 1; -- done` -> `select 1`)."""
    prev = None
    while prev != sql:
        prev = sql
        sql = _TRAILING_COMMENT.sub("", sql.rstrip()).rstrip().rstrip(";")
    return sql.strip()


_DOLLAR = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$")


def split_statements(sql: str) -> list[str]:
    """Statements at top-level `;`, skipping strings, quoted identifiers, $tag$ quotes and comments.

    Comment-only pieces are dropped. Mirrors apps/web/src/lib/sqlStatements.ts.
    """
    out: list[str] = []
    start, i, n, has_code = 0, 0, len(sql), False

    def push(end: int) -> None:
        if has_code:
            out.append(sql[start:end])

    while i < n:
        c, nxt = sql[i], sql[i + 1] if i + 1 < n else ""
        if c == "-" and nxt == "-":
            nl = sql.find("\n", i)
            i = n if nl == -1 else nl + 1
        elif c == "/" and nxt == "*":
            depth, i = 1, i + 2
            while i < n and depth:
                if sql.startswith("/*", i):
                    depth, i = depth + 1, i + 2
                elif sql.startswith("*/", i):
                    depth, i = depth - 1, i + 2
                else:
                    i += 1
        elif c in "'\"":
            has_code, i = True, i + 1
            while i < n:
                if sql[i] == c:
                    if i + 1 < n and sql[i + 1] == c:
                        i += 2
                        continue
                    break
                i += 1
            i += 1
        elif c == "$":
            has_code = True
            m = _DOLLAR.match(sql, i)
            if m:
                close = sql.find(m.group(0), m.end())
                i = n if close == -1 else close + len(m.group(0))
            else:
                i += 1
        elif c == ";":
            push(i)
            start, i, has_code = i + 1, i + 1, False
        else:
            if not c.isspace():
                has_code = True
            i += 1
    push(n)
    return out


def run_readonly(sql: str, max_rows: int) -> dict[str, Any]:
    settings = get_settings()
    engine = get_analytics_engine()
    if engine is None:
        raise QueryNotConfigured()
    max_rows = max(1, min(max_rows, settings.query_max_rows))
    timeout_ms = max(1, settings.query_timeout_seconds) * 1000
    sql = strip_trailing(sql)
    if not sql:
        raise QueryError("The query is empty")

    started = time.perf_counter()
    try:
        raw = engine.raw_connection()
    except Exception as exc:  # noqa: BLE001
        raise QueryError(f"Cannot connect to the analytics database: {_message(exc)}") from exc
    try:
        dbapi: Any = raw.driver_connection
        cur = dbapi.cursor()
        try:
            # Newline before ")" so a trailing `-- comment` cannot swallow it.
            wrapped = f"SELECT * FROM (\n{sql}\n) AS lab_query LIMIT {int(max_rows) + 1}"  # noqa: S608 - the owner's own read-only SQL, by design
            if engine.dialect.name == "postgresql":
                # psycopg has already opened a transaction implicitly; this must be its first statement.
                cur.execute("SET TRANSACTION READ ONLY")
                cur.execute(f"SET LOCAL statement_timeout = {int(timeout_ms)}")
                cur.execute("SET LOCAL idle_in_transaction_session_timeout = 60000")
            else:  # SQLite (tests / local dev)
                cur.execute("PRAGMA query_only = ON")
            cur.execute(wrapped)  # no params: `%` in the SQL is taken literally
            columns = [d[0] for d in (cur.description or [])]
            fetched = cur.fetchmany(max_rows + 1) if columns else []
        finally:
            try:
                cur.close()
            finally:
                dbapi.rollback()
                if engine.dialect.name == "sqlite":
                    dbapi.execute("PRAGMA query_only = OFF")
    except QueryError:
        raise
    except Exception as exc:  # noqa: BLE001 - driver errors become user-facing messages
        msg = _message(exc)
        if "statement timeout" in msg or "canceling statement" in msg:
            msg = f"Query timed out after {settings.query_timeout_seconds}s. Filter or aggregate more."
        raise QueryError(msg) from exc
    finally:
        raw.close()

    truncated = len(fetched) > max_rows
    rows = [[_cell(v) for v in row] for row in fetched[:max_rows]]
    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
        "elapsed_ms": int((time.perf_counter() - started) * 1000),
    }


def check() -> str:
    """For /health/ready: never fails readiness, just reports."""
    engine = get_analytics_engine()
    if engine is None:
        return "not configured"
    try:
        with engine.connect() as conn:
            if engine.dialect.name != "postgresql":
                return "ok"
            role = conn.exec_driver_sql("SELECT current_user").scalar()
        return f"ok (role {role})"
    except Exception as exc:  # noqa: BLE001
        return f"error: {exc.__class__.__name__}"
