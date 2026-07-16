"""sprites table

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sprites",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("sprite_id", sa.Integer(), nullable=False),
        sa.Column("frame_index", sa.SmallInteger(), nullable=False),
        sa.Column("width", sa.SmallInteger(), nullable=False),
        sa.Column("height", sa.SmallInteger(), nullable=False),
        sa.Column("png_path", sa.String(length=255), nullable=False),
        sa.Column("webp_path", sa.String(length=255), nullable=False),
        sa.UniqueConstraint(
            "cache_build_id", "sprite_id", "frame_index", name="uq_sprite_frame"
        ),
    )
    op.create_index("ix_sprites_cache_build_id", "sprites", ["cache_build_id"])


def downgrade() -> None:
    op.drop_index("ix_sprites_cache_build_id", table_name="sprites")
    op.drop_table("sprites")
