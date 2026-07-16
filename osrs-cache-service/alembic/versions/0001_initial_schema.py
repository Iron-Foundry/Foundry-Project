"""initial schema: cache_builds, raw_groups

Revision ID: 0001
Revises:
Create Date: 2026-07-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cache_builds",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("openrs2_cache_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("game_build_major", sa.Integer(), nullable=False),
        sa.Column("game_build_minor", sa.Integer(), nullable=True),
        sa.Column("cache_timestamp", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False),
    )

    op.create_table(
        "raw_groups",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("archive", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.UniqueConstraint(
            "cache_build_id", "archive", "group_id", name="uq_raw_group"
        ),
    )
    op.create_index("ix_raw_groups_cache_build_id", "raw_groups", ["cache_build_id"])


def downgrade() -> None:
    op.drop_index("ix_raw_groups_cache_build_id", table_name="raw_groups")
    op.drop_table("raw_groups")
    op.drop_table("cache_builds")
