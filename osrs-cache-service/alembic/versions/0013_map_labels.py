"""worldmap labels (compositemap elements)

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "map_labels",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("text_color", sa.Integer(), nullable=True),
        sa.Column("sprite_id", sa.Integer(), nullable=False),
        sa.Column("plane", sa.SmallInteger(), nullable=False),
        sa.Column("world_x", sa.Integer(), nullable=False),
        sa.Column("world_y", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_map_labels_cache_build_id", "map_labels", ["cache_build_id"])
    op.create_index("ix_map_label_plane", "map_labels", ["cache_build_id", "plane"])


def downgrade() -> None:
    op.drop_index("ix_map_label_plane", table_name="map_labels")
    op.drop_index("ix_map_labels_cache_build_id", table_name="map_labels")
    op.drop_table("map_labels")
