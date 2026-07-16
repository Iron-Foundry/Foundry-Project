"""Packs a region-plane's terrain into a fixed-size blob for the map_terrain BYTEA.

18.3M non-empty tiles across the world make a per-tile table an order of magnitude
larger than everything else in the database combined. A region-plane is always
exactly 64x64 tiles, so its terrain packs into a fixed 8-byte-per-tile record array
that Postgres then TOAST-compresses. Per-tile SQL is traded away for roughly a
twentieth of the storage; the renderer wants a whole region at once anyway.
"""

from __future__ import annotations

import numpy as np

from app.maps.constants import REGION_SIZE, TILES_PER_PLANE
from app.maps.terrain import TerrainDefinition

TERRAIN_DTYPE = np.dtype(
    [
        ("height", np.uint8),
        ("underlay_id", np.uint16),
        ("overlay_id", np.int16),
        ("overlay_path", np.uint8),
        ("overlay_rotation", np.uint8),
        ("settings", np.uint8),
    ]
)

PACKED_SIZE = TERRAIN_DTYPE.itemsize * TILES_PER_PLANE


class TerrainUnpackError(RuntimeError):
    pass


def pack_terrain(terrain: TerrainDefinition, plane: int) -> bytes:
    packed = np.zeros((REGION_SIZE, REGION_SIZE), dtype=TERRAIN_DTYPE)
    packed["height"] = terrain.height[plane]
    packed["underlay_id"] = terrain.underlay_id[plane]
    packed["overlay_id"] = terrain.overlay_id[plane]
    packed["overlay_path"] = terrain.overlay_path[plane]
    packed["overlay_rotation"] = terrain.overlay_rotation[plane]
    packed["settings"] = terrain.settings[plane]
    return packed.tobytes()


def unpack_terrain(data: bytes) -> np.ndarray:
    """Returns a (64, 64) structured array with the TERRAIN_DTYPE fields."""
    if len(data) != PACKED_SIZE:
        raise TerrainUnpackError(
            f"expected {PACKED_SIZE} bytes of packed terrain, got {len(data)}"
        )
    return np.frombuffer(data, dtype=TERRAIN_DTYPE).reshape(REGION_SIZE, REGION_SIZE)


def plane_is_empty(terrain: TerrainDefinition, plane: int) -> bool:
    return not (
        terrain.height[plane].any()
        or terrain.underlay_id[plane].any()
        or terrain.overlay_id[plane].any()
        or terrain.settings[plane].any()
    )
