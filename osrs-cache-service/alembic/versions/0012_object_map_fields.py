"""object map-render fields: wall_or_door, map_scene_id, offset_y

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "objects",
        sa.Column(
            "wall_or_door", sa.SmallInteger(), nullable=False, server_default="0"
        ),
    )
    # map_scene_id (opcode 68) and offset_y (opcode 72) are decoded as unsigned
    # shorts (0-65535), which overflow int2 (max 32767) - store them as int4.
    op.add_column(
        "objects",
        sa.Column("map_scene_id", sa.Integer(), nullable=False, server_default="-1"),
    )
    op.add_column(
        "objects",
        sa.Column("offset_y", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("objects", "offset_y")
    op.drop_column("objects", "map_scene_id")
    op.drop_column("objects", "wall_or_door")
