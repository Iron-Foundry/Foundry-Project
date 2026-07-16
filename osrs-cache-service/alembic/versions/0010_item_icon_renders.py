"""item_icon_renders table

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "item_icon_renders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("size", sa.SmallInteger(), nullable=False),
        sa.Column("webp_path", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "cache_build_id", "item_id", "size", name="uq_item_icon_render"
        ),
    )
    op.create_index(
        "ix_item_icon_renders_cache_build_id", "item_icon_renders", ["cache_build_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_item_icon_renders_cache_build_id", table_name="item_icon_renders")
    op.drop_table("item_icon_renders")
