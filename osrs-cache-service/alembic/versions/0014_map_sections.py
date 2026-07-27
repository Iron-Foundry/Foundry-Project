"""worldmap sections (details group)

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "map_sections",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("safe_name", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("world_x", sa.Integer(), nullable=False),
        sa.Column("world_y", sa.Integer(), nullable=False),
        sa.Column("plane", sa.SmallInteger(), nullable=False),
        sa.Column("is_surface", sa.Boolean(), nullable=False),
        sa.Column("default_zoom", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_map_sections_cache_build_id", "map_sections", ["cache_build_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_map_sections_cache_build_id", table_name="map_sections")
    op.drop_table("map_sections")
