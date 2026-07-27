"""item icon recipe fields (model, zoom/rotation/offset, resize, lighting, recolor)

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("items", sa.Column("inventory_model", sa.Integer(), nullable=True))
    op.add_column("items", sa.Column("zoom2d", sa.Integer(), nullable=True))
    op.add_column("items", sa.Column("xan2d", sa.Integer(), nullable=True))
    op.add_column("items", sa.Column("yan2d", sa.Integer(), nullable=True))
    op.add_column("items", sa.Column("x_offset2d", sa.Integer(), nullable=True))
    op.add_column("items", sa.Column("y_offset2d", sa.Integer(), nullable=True))
    op.add_column("items", sa.Column("resize_x", sa.Integer(), nullable=True))
    op.add_column("items", sa.Column("resize_y", sa.Integer(), nullable=True))
    op.add_column("items", sa.Column("resize_z", sa.Integer(), nullable=True))
    op.add_column(
        "items", sa.Column("ambient", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "items", sa.Column("contrast", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column("items", sa.Column("color_find", sa.JSON(), nullable=True))
    op.add_column("items", sa.Column("color_replace", sa.JSON(), nullable=True))
    op.add_column("items", sa.Column("texture_find", sa.JSON(), nullable=True))
    op.add_column("items", sa.Column("texture_replace", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("items", "texture_replace")
    op.drop_column("items", "texture_find")
    op.drop_column("items", "color_replace")
    op.drop_column("items", "color_find")
    op.drop_column("items", "contrast")
    op.drop_column("items", "ambient")
    op.drop_column("items", "resize_z")
    op.drop_column("items", "resize_y")
    op.drop_column("items", "resize_x")
    op.drop_column("items", "y_offset2d")
    op.drop_column("items", "x_offset2d")
    op.drop_column("items", "yan2d")
    op.drop_column("items", "xan2d")
    op.drop_column("items", "zoom2d")
    op.drop_column("items", "inventory_model")
