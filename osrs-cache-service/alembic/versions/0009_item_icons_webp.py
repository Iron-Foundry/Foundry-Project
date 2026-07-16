"""item_icons: rename png_path -> webp_path (icons now exported as WebP)

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-14

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("item_icons", "png_path", new_column_name="webp_path")


def downgrade() -> None:
    op.alter_column("item_icons", "webp_path", new_column_name="png_path")
