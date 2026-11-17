"""Enable row level security on all tables (PostgreSQL only).

Supabase exposes the `public` schema through its Data API to anyone holding the publishable key.
With RLS enabled and no policies, those roles (anon/authenticated) can read or write nothing.
The API connects as the table owner, which is not subject to RLS, so it is unaffected.

Revision ID: 0002
Revises: 0001
"""

from __future__ import annotations

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TABLES = (
    "users",
    "projects",
    "runs",
    "metrics",
    "artifacts",
    "agent_credentials",
    "idempotency_records",
    "alembic_version",
)


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
