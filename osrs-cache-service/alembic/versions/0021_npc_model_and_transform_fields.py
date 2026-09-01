"""npc model ids, actions, recolours and varbit transforms

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-01

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_JSON_COLUMNS = (
    "model_ids",
    "chathead_model_ids",
    "actions",
    "color_find",
    "color_replace",
    "texture_find",
    "texture_replace",
    "configs",
)
_INT_COLUMNS = ("varbit_id", "varp_index")


def upgrade() -> None:
    for name in _JSON_COLUMNS:
        op.add_column("npcs", sa.Column(name, sa.JSON(), nullable=True))
    for name in _INT_COLUMNS:
        op.add_column("npcs", sa.Column(name, sa.Integer(), nullable=True))


def downgrade() -> None:
    for name in _INT_COLUMNS:
        op.drop_column("npcs", name)
    for name in _JSON_COLUMNS:
        op.drop_column("npcs", name)
