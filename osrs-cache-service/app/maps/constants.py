"""Geometry and archive constants for the OSRS map (archive 5).

Unlike older caches, archive 5 in the current live build carries no group name
hashes - the reference index has ``flags=0x04`` (lengths only). The group id *is*
the region id, so the historical ``m{x}_{y}`` / ``l{x}_{y}`` name lookup is neither
possible nor needed. Each group holds 5 files; only 0 (terrain) and 1 (locations)
carry anything we use.
"""

from __future__ import annotations

MAP_ARCHIVE = 5
TERRAIN_FILE = 0
LOCATIONS_FILE = 1

REGION_SIZE = 64
PLANES = 4
# The composited "ground" overview - each tile drawn at the plane the game shows on
# its world map (bridges, elevated walkways). Baked as an extra pseudo-plane above
# the four real planes so it rides the existing per-plane tile path and manifest.
MAP_OVERVIEW_PLANE = PLANES
TILES_PER_PLANE = REGION_SIZE * REGION_SIZE

MAX_REGION_ID = 25287


def region_id(region_x: int, region_y: int) -> int:
    return (region_x << 8) | region_y


def region_coords(region: int) -> tuple[int, int]:
    return region >> 8, region & 0xFF


def region_base(region: int) -> tuple[int, int]:
    """World coordinate of a region's south-west corner."""
    region_x, region_y = region_coords(region)
    return region_x << 6, region_y << 6
