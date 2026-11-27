"""Dashboard per project: which run it shows, and whether it is published.

Revision ID: 0006
Revises: 0005
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dashboards",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.String(length=160), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("project_id"),
    )
    if op.get_context().dialect.name == "postgresql":
        # Same as 0002: block the Supabase Data API (publishable key) from this table.
        op.execute("ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("dashboards")
