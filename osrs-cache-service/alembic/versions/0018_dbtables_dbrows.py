"""dbtables and dbrows tables

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dbtables",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("dbtable_id", sa.Integer(), nullable=False),
        sa.Column("columns", JSONB(), nullable=False),
        sa.UniqueConstraint("cache_build_id", "dbtable_id", name="uq_dbtable"),
    )
    op.create_index("ix_dbtables_cache_build_id", "dbtables", ["cache_build_id"])

    op.create_table(
        "dbrows",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("dbrow_id", sa.Integer(), nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=True),
        sa.Column("columns", JSONB(), nullable=False),
        sa.UniqueConstraint("cache_build_id", "dbrow_id", name="uq_dbrow"),
    )
    op.create_index("ix_dbrows_cache_build_id", "dbrows", ["cache_build_id"])
    op.create_index("ix_dbrows_table_id", "dbrows", ["table_id"])


def downgrade() -> None:
    op.drop_index("ix_dbrows_table_id", table_name="dbrows")
    op.drop_index("ix_dbrows_cache_build_id", table_name="dbrows")
    op.drop_table("dbrows")
    op.drop_index("ix_dbtables_cache_build_id", table_name="dbtables")
    op.drop_table("dbtables")
