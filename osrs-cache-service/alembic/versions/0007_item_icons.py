"""item_icons table

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "item_icons",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("width", sa.SmallInteger(), nullable=False),
        sa.Column("height", sa.SmallInteger(), nullable=False),
        sa.Column("png_path", sa.String(length=255), nullable=False),
        sa.UniqueConstraint("cache_build_id", "item_id", name="uq_item_icon"),
    )
    op.create_index("ix_item_icons_cache_build_id", "item_icons", ["cache_build_id"])


def downgrade() -> None:
    op.drop_index("ix_item_icons_cache_build_id", table_name="item_icons")
    op.drop_table("item_icons")
