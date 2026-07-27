"""enums table

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "enums",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("enum_id", sa.Integer(), nullable=False),
        sa.Column("key_type", sa.String(length=1), nullable=True),
        sa.Column("value_type", sa.String(length=1), nullable=True),
        sa.Column("default_int", sa.Integer(), nullable=True),
        sa.Column("default_string", sa.String(), nullable=True),
        sa.Column("entries", JSONB(), nullable=False),
        sa.UniqueConstraint("cache_build_id", "enum_id", name="uq_enum"),
    )
    op.create_index("ix_enums_cache_build_id", "enums", ["cache_build_id"])


def downgrade() -> None:
    op.drop_index("ix_enums_cache_build_id", table_name="enums")
    op.drop_table("enums")
