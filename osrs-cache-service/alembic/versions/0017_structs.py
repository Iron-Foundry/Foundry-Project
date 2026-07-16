"""structs table

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "structs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("struct_id", sa.Integer(), nullable=False),
        sa.Column("params", JSONB(), nullable=False),
        sa.UniqueConstraint("cache_build_id", "struct_id", name="uq_struct"),
    )
    op.create_index("ix_structs_cache_build_id", "structs", ["cache_build_id"])


def downgrade() -> None:
    op.drop_index("ix_structs_cache_build_id", table_name="structs")
    op.drop_table("structs")
