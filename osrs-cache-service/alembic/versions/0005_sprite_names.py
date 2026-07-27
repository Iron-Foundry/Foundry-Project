"""sprite name/category columns (from RuneLite SpriteID catalog)

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sprites", sa.Column("name", sa.String(length=255), nullable=True))
    op.add_column(
        "sprites", sa.Column("category", sa.String(length=255), nullable=True)
    )
    op.create_index("ix_sprites_category", "sprites", ["category"])


def downgrade() -> None:
    op.drop_index("ix_sprites_category", table_name="sprites")
    op.drop_column("sprites", "category")
    op.drop_column("sprites", "name")
