"""initial LandWeaver tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-20
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
    )
    op.create_table(
        "parcels",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False, index=True),
        sa.Column("boundary", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("north_angle_deg", sa.Float(), nullable=False),
        sa.Column("area_m2", sa.Float(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
    )
    op.create_table(
        "constraint_sets",
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), primary_key=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    )
    op.create_table(
        "building_prototypes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False, index=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    )
    op.create_table(
        "site_options",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False, index=True),
        sa.Column("strategy", sa.String(length=32), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("site_options")
    op.drop_table("building_prototypes")
    op.drop_table("constraint_sets")
    op.drop_table("parcels")
    op.drop_table("projects")

