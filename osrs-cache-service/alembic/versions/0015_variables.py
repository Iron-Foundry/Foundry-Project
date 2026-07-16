"""varplayer, varclient, varclientstring tables

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "varplayers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("varp_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.Integer(), nullable=True),
        sa.UniqueConstraint("cache_build_id", "varp_id", name="uq_varplayer"),
    )
    op.create_index("ix_varplayers_cache_build_id", "varplayers", ["cache_build_id"])

    for table, uq in (
        ("varclients", "uq_varclient"),
        ("varclientstrings", "uq_varclientstring"),
    ):
        op.create_table(
            table,
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("cache_build_id", sa.Integer(), nullable=False),
            sa.Column("varc_id", sa.Integer(), nullable=False),
            sa.Column("persist", sa.Boolean(), nullable=False),
            sa.UniqueConstraint("cache_build_id", "varc_id", name=uq),
        )
        op.create_index(f"ix_{table}_cache_build_id", table, ["cache_build_id"])


def downgrade() -> None:
    for table in ("varclientstrings", "varclients", "varplayers"):
        op.drop_index(f"ix_{table}_cache_build_id", table_name=table)
        op.drop_table(table)
