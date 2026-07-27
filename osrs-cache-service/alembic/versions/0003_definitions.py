"""items, npcs, objects tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-13

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("examine", sa.Text(), nullable=False),
        sa.Column("stackable", sa.Boolean(), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("members", sa.Boolean(), nullable=False),
        sa.Column("tradeable", sa.Boolean(), nullable=False),
        sa.Column("noted_id", sa.Integer(), nullable=True),
        sa.Column("noted_template", sa.Integer(), nullable=True),
        sa.Column("placeholder_id", sa.Integer(), nullable=True),
        sa.Column("placeholder_template", sa.Integer(), nullable=True),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.UniqueConstraint("cache_build_id", "item_id", name="uq_item"),
    )
    op.create_index("ix_items_cache_build_id", "items", ["cache_build_id"])

    op.create_table(
        "npcs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("npc_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("combat_level", sa.Integer(), nullable=True),
        sa.Column("size", sa.Integer(), nullable=True),
        sa.Column("category", sa.Integer(), nullable=True),
        sa.Column("interactable", sa.Boolean(), nullable=False),
        sa.Column("minimap_visible", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("cache_build_id", "npc_id", name="uq_npc"),
    )
    op.create_index("ix_npcs_cache_build_id", "npcs", ["cache_build_id"])

    op.create_table(
        "objects",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("object_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("size_x", sa.Integer(), nullable=False),
        sa.Column("size_y", sa.Integer(), nullable=False),
        sa.Column("animation_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.Integer(), nullable=True),
        sa.Column("interactive", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("cache_build_id", "object_id", name="uq_object"),
    )
    op.create_index("ix_objects_cache_build_id", "objects", ["cache_build_id"])


def downgrade() -> None:
    op.drop_index("ix_objects_cache_build_id", table_name="objects")
    op.drop_table("objects")
    op.drop_index("ix_npcs_cache_build_id", table_name="npcs")
    op.drop_table("npcs")
    op.drop_index("ix_items_cache_build_id", table_name="items")
    op.drop_table("items")
