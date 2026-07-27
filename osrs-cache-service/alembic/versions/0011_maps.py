"""map tables: floors, areas, squares, terrain, locations, object map_area_id

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("objects", sa.Column("map_area_id", sa.Integer(), nullable=True))
    op.create_index("ix_objects_map_area_id", "objects", ["map_area_id"])

    op.create_table(
        "underlays",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("underlay_id", sa.Integer(), nullable=False),
        sa.Column("rgb", sa.Integer(), nullable=False),
        sa.UniqueConstraint("cache_build_id", "underlay_id", name="uq_underlay"),
    )
    op.create_index("ix_underlays_cache_build_id", "underlays", ["cache_build_id"])

    op.create_table(
        "overlays",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("overlay_id", sa.Integer(), nullable=False),
        sa.Column("rgb", sa.Integer(), nullable=False),
        sa.Column("texture", sa.SmallInteger(), nullable=False),
        sa.Column("hide_underlay", sa.Boolean(), nullable=False),
        sa.Column("secondary_rgb", sa.Integer(), nullable=False),
        sa.UniqueConstraint("cache_build_id", "overlay_id", name="uq_overlay"),
    )
    op.create_index("ix_overlays_cache_build_id", "overlays", ["cache_build_id"])

    op.create_table(
        "areas",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("sprite_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("text_color", sa.Integer(), nullable=True),
        sa.Column("category", sa.Integer(), nullable=True),
        sa.UniqueConstraint("cache_build_id", "area_id", name="uq_area"),
    )
    op.create_index("ix_areas_cache_build_id", "areas", ["cache_build_id"])

    op.create_table(
        "map_squares",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("region_id", sa.Integer(), nullable=False),
        sa.Column("region_x", sa.SmallInteger(), nullable=False),
        sa.Column("region_y", sa.SmallInteger(), nullable=False),
        sa.Column("plane_mask", sa.SmallInteger(), nullable=False),
        sa.UniqueConstraint("cache_build_id", "region_id", name="uq_map_square"),
    )
    op.create_index("ix_map_squares_cache_build_id", "map_squares", ["cache_build_id"])

    op.create_table(
        "map_terrain",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("region_id", sa.Integer(), nullable=False),
        sa.Column("plane", sa.SmallInteger(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.UniqueConstraint(
            "cache_build_id", "region_id", "plane", name="uq_map_terrain"
        ),
    )
    op.create_index("ix_map_terrain_cache_build_id", "map_terrain", ["cache_build_id"])

    op.create_table(
        "map_locations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_build_id", sa.Integer(), nullable=False),
        sa.Column("region_id", sa.Integer(), nullable=False),
        sa.Column("object_id", sa.Integer(), nullable=False),
        sa.Column("plane", sa.SmallInteger(), nullable=False),
        sa.Column("world_x", sa.Integer(), nullable=False),
        sa.Column("world_y", sa.Integer(), nullable=False),
        sa.Column("shape", sa.SmallInteger(), nullable=False),
        sa.Column("orientation", sa.SmallInteger(), nullable=False),
    )
    op.create_index(
        "ix_map_location_object", "map_locations", ["cache_build_id", "object_id"]
    )
    op.create_index(
        "ix_map_location_position",
        "map_locations",
        ["cache_build_id", "plane", "world_x", "world_y"],
    )


def downgrade() -> None:
    op.drop_table("map_locations")
    op.drop_index("ix_map_terrain_cache_build_id", table_name="map_terrain")
    op.drop_table("map_terrain")
    op.drop_index("ix_map_squares_cache_build_id", table_name="map_squares")
    op.drop_table("map_squares")
    op.drop_index("ix_areas_cache_build_id", table_name="areas")
    op.drop_table("areas")
    op.drop_index("ix_overlays_cache_build_id", table_name="overlays")
    op.drop_table("overlays")
    op.drop_index("ix_underlays_cache_build_id", table_name="underlays")
    op.drop_table("underlays")
    op.drop_index("ix_objects_map_area_id", table_name="objects")
    op.drop_column("objects", "map_area_id")
