"""Workspace notebook per project: the order of SQL cells and Markdown cells.

Revision ID: 0005
Revises: 0004
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notebooks",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("cells", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("last_edited_by", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id"),
    )
    if op.get_context().dialect.name == "postgresql":
        # Same as 0002: block the Supabase Data API (publishable key) from this table.
        op.execute("ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("notebooks")
