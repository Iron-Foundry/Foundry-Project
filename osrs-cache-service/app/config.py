"""Environment variable loading for the OSRS cache service."""

from __future__ import annotations

import os

DATABASE_URL = os.getenv("DATABASE_URL", "")
OPENRS2_BASE_URL = os.getenv("OPENRS2_BASE_URL", "https://archive.openrs2.org")
CACHE_SYNC_INTERVAL_HOURS = float(os.getenv("CACHE_SYNC_INTERVAL_HOURS", "0.5"))
CACHE_SCOPE = os.getenv("OPENRS2_CACHE_SCOPE", "runescape")
SPRITES_DIR = os.getenv("SPRITES_DIR", "/data/sprites")
SPRITE_ARCHIVE = int(os.getenv("OSRS_SPRITE_ARCHIVE", "8"))
ICONS_DIR = os.getenv("ICONS_DIR", "/data/icons")
MODEL_ARCHIVE = int(os.getenv("OSRS_MODEL_ARCHIVE", "7"))
RENDERS_DIR = os.getenv("RENDERS_DIR", "/data/renders")
RENDER_CACHE_TTL_DAYS = float(os.getenv("RENDER_CACHE_TTL_DAYS", "3"))
RENDER_MIN_SIZE = 32
RENDER_MAX_SIZE = 4096

MAPS_DIR = os.getenv("MAPS_DIR", "/data/maps")
MAP_TILE_SIZE = 256
MAP_MIN_ZOOM = 0
MAP_MAX_ZOOM = 5
MAP_BASE_ZOOM = MAP_MAX_ZOOM


def map_pixels_per_tile(zoom: int) -> float:
    """Game-tile edge in pixels at a zoom level: 0.25 at zoom 0 up to 8 at zoom 5."""
    return 2.0 ** (zoom - 2)
