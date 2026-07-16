"""Builds the /map/meta manifest, including the region coverage bitmap.

The manifest is the single source of the coordinate contract the client renders
against: tile size, zoom range, pixels-per-tile, the world extent, and which regions
actually exist. Coverage is one bit per region per plane over the occupied bounding
box, so the client can skip a tile whose regions do not exist instead of fetching it
and taking a 404 - most of the map's bounding box is empty.
"""

from __future__ import annotations

import base64

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import (
    MAP_BASE_ZOOM,
    MAP_MAX_ZOOM,
    MAP_MIN_ZOOM,
    MAP_TILE_SIZE,
    map_pixels_per_tile,
)
from app.db.models import MapSquare
from app.maps.constants import MAP_OVERVIEW_PLANE, PLANES, REGION_SIZE
from app.maps.tiles import WORLD_TILES


async def build_manifest(session: AsyncSession, build_id: int) -> dict:
    rows = (
        await session.execute(
            select(MapSquare.region_x, MapSquare.region_y, MapSquare.plane_mask).where(
                MapSquare.cache_build_id == build_id
            )
        )
    ).all()

    zooms = list(range(MAP_MIN_ZOOM, MAP_MAX_ZOOM + 1))
    manifest: dict = {
        "build": build_id,
        "tileSize": MAP_TILE_SIZE,
        "minZoom": MAP_MIN_ZOOM,
        "maxZoom": MAP_MAX_ZOOM,
        "baseZoom": MAP_BASE_ZOOM,
        "worldTiles": WORLD_TILES,
        "regionSize": REGION_SIZE,
        "planes": PLANES,
        "overviewPlane": MAP_OVERVIEW_PLANE,
        "pixelsPerTile": [map_pixels_per_tile(z) for z in zooms],
        "scheme": "xyz",
        "format": "image/webp",
        "tileUrl": f"/map/{build_id}/{{plane}}/{{z}}/{{x}}/{{y}}.webp",
    }
    if not rows:
        manifest["coverage"] = None
        manifest["bounds"] = None
        return manifest

    min_x = min(r.region_x for r in rows)
    max_x = max(r.region_x for r in rows)
    min_y = min(r.region_y for r in rows)
    max_y = max(r.region_y for r in rows)
    width = max_x - min_x + 1
    height = max_y - min_y + 1

    # One bitmap per real plane, plus a final union bitmap for the overview
    # (a composite tile exists wherever any plane has terrain).
    planes = [bytearray((width * height + 7) // 8) for _ in range(PLANES + 1)]
    for row in rows:
        index = (row.region_y - min_y) * width + (row.region_x - min_x)
        for plane in range(PLANES):
            if row.plane_mask & (1 << plane):
                planes[plane][index >> 3] |= 1 << (index & 7)
        if row.plane_mask:
            planes[MAP_OVERVIEW_PLANE][index >> 3] |= 1 << (index & 7)

    manifest["bounds"] = {
        "minX": min_x * REGION_SIZE,
        "minY": min_y * REGION_SIZE,
        "maxX": (max_x + 1) * REGION_SIZE,
        "maxY": (max_y + 1) * REGION_SIZE,
    }
    manifest["coverage"] = {
        "regionMinX": min_x,
        "regionMinY": min_y,
        "regionWidth": width,
        "regionHeight": height,
        "planeBits": [base64.b64encode(bytes(p)).decode() for p in planes],
    }
    return manifest
