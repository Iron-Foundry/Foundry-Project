"""varbits table

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-13

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "varbits",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("varbit_id", sa.Integer(), nullable=False),
        sa.Column("varp_index", sa.Integer(), nullable=True),
        sa.Column("least_significant_bit", sa.Integer(), nullable=True),
        sa.Column("most_significant_bit", sa.Integer(), nullable=True),
        sa.UniqueConstraint("cache_build_id", "varbit_id", name="uq_varbit"),
    )
    op.create_index("ix_varbits_cache_build_id", "varbits", ["cache_build_id"])


def downgrade() -> None:
    op.drop_index("ix_varbits_cache_build_id", table_name="varbits")
    op.drop_table("varbits")
