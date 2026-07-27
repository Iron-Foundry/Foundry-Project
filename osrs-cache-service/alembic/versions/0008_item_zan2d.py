"""item zan2d field (icon roll rotation, opcode 95 - previously discarded)

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("items", sa.Column("zan2d", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("items", "zan2d")
