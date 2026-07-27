"""gamevals table

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "gamevals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("namespace", sa.String(), nullable=False),
        sa.Column("entry_id", sa.Integer(), nullable=False),
        sa.Column("sub_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.UniqueConstraint(
            "cache_build_id", "namespace", "entry_id", "sub_id", name="uq_gameval"
        ),
    )
    op.create_index("ix_gamevals_cache_build_id", "gamevals", ["cache_build_id"])
    op.create_index("ix_gamevals_namespace", "gamevals", ["namespace"])


def downgrade() -> None:
    op.drop_index("ix_gamevals_namespace", table_name="gamevals")
    op.drop_index("ix_gamevals_cache_build_id", table_name="gamevals")
    op.drop_table("gamevals")
