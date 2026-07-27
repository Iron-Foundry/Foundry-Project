"""Query helpers behind the map data endpoints.

Kept out of the router so the endpoint functions stay declarative and the SQL lives in
one place. A map icon is the join the location table was built for: a placed object,
the object's area link, and that area's sprite and name.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from sqlalchemy import Row, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Area,
    MapLabel,
    MapLocation,
    MapSection,
    MapSquare,
    MapTerrain,
    Object,
)
from app.maps.constants import PLANES, REGION_SIZE, region_base, region_id
from app.maps.packing import unpack_terrain


async def fetch_region(
    session: AsyncSession, build_id: int, region_id: int
) -> dict[str, Any] | None:
    square = (
        await session.execute(
            select(MapSquare).where(
                MapSquare.cache_build_id == build_id,
                MapSquare.region_id == region_id,
            )
        )
    ).scalar_one_or_none()
    if square is None:
        return None
    base_x, base_y = region_base(region_id)
    return {
        "regionId": region_id,
        "regionX": square.region_x,
        "regionY": square.region_y,
        "baseX": base_x,
        "baseY": base_y,
        "planes": [p for p in range(PLANES) if square.plane_mask & (1 << p)],
    }


async def fetch_locations(
    session: AsyncSession,
    build_id: int,
    object_id: int | None,
    plane: int | None,
    bbox: tuple[int, int, int, int] | None,
    limit: int,
) -> dict[str, Any]:
    query = select(
        MapLocation.object_id,
        MapLocation.plane,
        MapLocation.world_x,
        MapLocation.world_y,
        MapLocation.shape,
        MapLocation.orientation,
    ).where(MapLocation.cache_build_id == build_id)
    if object_id is not None:
        query = query.where(MapLocation.object_id == object_id)
    if plane is not None:
        query = query.where(MapLocation.plane == plane)
    if bbox is not None:
        min_x, min_y, max_x, max_y = bbox
        query = query.where(
            MapLocation.world_x >= min_x,
            MapLocation.world_x <= max_x,
            MapLocation.world_y >= min_y,
            MapLocation.world_y <= max_y,
        )
    rows = (await session.execute(query.limit(limit))).all()
    return {
        "count": len(rows),
        "locations": [
            {
                "objectId": r.object_id,
                "plane": r.plane,
                "x": r.world_x,
                "y": r.world_y,
                "shape": r.shape,
                "orientation": r.orientation,
            }
            for r in rows
        ],
    }


def _icon_query(build_id: int):
    return (
        select(
            MapLocation.world_x,
            MapLocation.world_y,
            MapLocation.plane,
            Area.sprite_id,
            Area.name,
        )
        .join(
            Object,
            (Object.cache_build_id == MapLocation.cache_build_id)
            & (Object.object_id == MapLocation.object_id),
        )
        .join(
            Area,
            (Area.cache_build_id == MapLocation.cache_build_id)
            & (Area.area_id == Object.map_area_id),
        )
        .where(
            MapLocation.cache_build_id == build_id,
            Object.map_area_id.is_not(None),
            Area.sprite_id >= 0,
        )
    )


def _icon_dict(row: Row[tuple[int, int, int, int, str | None]]) -> dict[str, Any]:
    return {
        "x": row.world_x,
        "y": row.world_y,
        "plane": row.plane,
        "spriteId": row.sprite_id,
        "name": row.name,
    }


async def fetch_icons(
    session: AsyncSession, build_id: int, plane: int | None
) -> dict[str, Any]:
    query = _icon_query(build_id)
    if plane is not None:
        query = query.where(MapLocation.plane == plane)
    rows = (await session.execute(query)).all()
    return {"count": len(rows), "icons": [_icon_dict(r) for r in rows]}


async def _region_settings(
    session: AsyncSession, build_id: int, region_ids: set[int]
) -> dict[tuple[int, int], np.ndarray]:
    """settings (64x64) per (region_id, plane) for planes 0 and 1 of the given regions."""
    if not region_ids:
        return {}
    rows = (
        await session.execute(
            select(MapTerrain.region_id, MapTerrain.plane, MapTerrain.data).where(
                MapTerrain.cache_build_id == build_id,
                MapTerrain.plane.in_((0, 1)),
                MapTerrain.region_id.in_(region_ids),
            )
        )
    ).all()
    return {(r.region_id, r.plane): unpack_terrain(r.data)["settings"] for r in rows}


async def fetch_sections(session: AsyncSession, build_id: int) -> dict[str, Any]:
    rows = (
        await session.execute(
            select(MapSection)
            .where(MapSection.cache_build_id == build_id)
            .order_by(MapSection.is_surface.desc(), MapSection.name)
        )
    ).scalars()
    return {
        "sections": [
            {
                "id": s.file_id,
                "safeName": s.safe_name,
                "name": s.name,
                "x": s.world_x,
                "y": s.world_y,
                "plane": s.plane,
                "isSurface": s.is_surface,
                "defaultZoom": s.default_zoom,
            }
            for s in rows
        ]
    }


async def fetch_labels(
    session: AsyncSession, build_id: int, plane: int | None
) -> dict[str, Any]:
    query = select(
        MapLabel.world_x,
        MapLabel.world_y,
        MapLabel.plane,
        MapLabel.name,
        MapLabel.text_color,
        MapLabel.sprite_id,
    ).where(MapLabel.cache_build_id == build_id)
    if plane is not None:
        query = query.where(MapLabel.plane == plane)
    rows = (await session.execute(query)).all()
    return {
        "count": len(rows),
        "labels": [
            {
                "x": r.world_x,
                "y": r.world_y,
                "plane": r.plane,
                "text": r.name,
                "color": r.text_color,
                "spriteId": r.sprite_id,
            }
            for r in rows
        ],
    }


async def fetch_overview_icons(session: AsyncSession, build_id: int) -> dict[str, Any]:
    """Icons visible on the composited ground map.

    Mirrors the terrain composite (see app/maps/render/composite.py) per icon: an
    icon at plane P shows when the tile's render flags put its plane on the surface
    - the same rule RuneLite's MapImageDumper applies to objects and map icons.
    """
    rows = (await session.execute(_icon_query(build_id))).all()
    region_ids = {region_id(r.world_x >> 6, r.world_y >> 6) for r in rows}
    settings = await _region_settings(session, build_id, region_ids)

    icons = []
    for r in rows:
        rid = region_id(r.world_x >> 6, r.world_y >> 6)
        lx, ly = r.world_x & (REGION_SIZE - 1), r.world_y & (REGION_SIZE - 1)
        s0 = settings.get((rid, 0))
        s1 = settings.get((rid, 1))
        s0v = int(s0[lx, ly]) if s0 is not None else 0
        s1v = int(s1[lx, ly]) if s1 is not None else 0
        tile_z = 1 if (s1v & 2) else 0
        if (r.plane == tile_z and (s0v & 24) == 0) or (
            r.plane == tile_z + 1 and (s1v & 8)
        ):
            icons.append(_icon_dict(r))
    return {"count": len(icons), "icons": icons}
