"""Project working notes and saved read-only queries.

Revision ID: 0003
Revises: 0002
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("last_edited_by", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notes_project_updated", "notes", ["project_id", "updated_at"])
    op.create_table(
        "saved_queries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("sql", sa.Text(), nullable=False),
        sa.Column("chart", sa.JSON(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("last_edited_by", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "name", name="uq_saved_queries_project_name"),
    )
    op.create_index("ix_saved_queries_project_id", "saved_queries", ["project_id"])
    if op.get_context().dialect.name == "postgresql":
        # Same as 0002: block the Supabase Data API (publishable key) from these tables.
        op.execute("ALTER TABLE notes ENABLE ROW LEVEL SECURITY")
        op.execute("ALTER TABLE saved_queries ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index("ix_saved_queries_project_id", table_name="saved_queries")
    op.drop_table("saved_queries")
    op.drop_index("ix_notes_project_updated", table_name="notes")
    op.drop_table("notes")
