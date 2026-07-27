"""dbtable_indexes table

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dbtable_indexes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.Column("column_id", sa.Integer(), nullable=False),
        sa.Column("tuples", JSONB(), nullable=False),
        sa.UniqueConstraint(
            "cache_build_id", "table_id", "column_id", name="uq_dbtable_index"
        ),
    )
    op.create_index(
        "ix_dbtable_indexes_cache_build_id", "dbtable_indexes", ["cache_build_id"]
    )
    op.create_index("ix_dbtable_indexes_table_id", "dbtable_indexes", ["table_id"])


def downgrade() -> None:
    op.drop_index("ix_dbtable_indexes_table_id", table_name="dbtable_indexes")
    op.drop_index("ix_dbtable_indexes_cache_build_id", table_name="dbtable_indexes")
    op.drop_table("dbtable_indexes")
