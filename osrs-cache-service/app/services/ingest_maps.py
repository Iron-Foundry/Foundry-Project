"""Decodes archive 5 (maps) into terrain rows and the location table.

Underlays, overlays and areas ride the normal definition registry (archive 2), so
this only owns archive 5: one MapSquare per region, one packed MapTerrain per
non-empty region-plane, and every placed object as a MapLocation.

Locations are ~5M rows per build. The ORM cannot add those one at a time in any
reasonable time, so they go in through asyncpg's binary COPY, streamed in chunks to
bound memory. COPY runs on the session's own connection, so it shares the ingest
transaction and commits (or rolls back) atomically with everything else.
"""

from __future__ import annotations

import asyncio

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MapSquare, MapTerrain
from app.js5.container import decompress
from app.js5.multifile import split_files
from app.js5.refindex import parse_reference_index
from app.js5.store import Js5Store
from app.maps.constants import (
    LOCATIONS_FILE,
    MAP_ARCHIVE,
    PLANES,
    TERRAIN_FILE,
    region_base,
    region_coords,
)
from app.maps.locations import decode_locations
from app.maps.packing import pack_terrain, plane_is_empty
from app.maps.terrain import decode_terrain

_YIELD_EVERY = 32
_COPY_CHUNK = 500_000
_LOCATION_COLUMNS = (
    "cache_build_id",
    "region_id",
    "object_id",
    "plane",
    "world_x",
    "world_y",
    "shape",
    "orientation",
)

LocationRecord = tuple[int, int, int, int, int, int, int, int]


async def ingest_maps(
    session: AsyncSession, cache_build_id: int, store: Js5Store
) -> None:
    ref_raw = store.read(255, MAP_ARCHIVE)
    ref_groups = {
        g.group_id: g for g in parse_reference_index(decompress(ref_raw).data)
    }

    pending: list[LocationRecord] = []
    squares = terrain_planes = locations = failed = 0

    for i, (region_id, ref) in enumerate(ref_groups.items()):
        if i % _YIELD_EVERY == 0:
            await asyncio.sleep(0)
        try:
            files = split_files(
                decompress(store.read(MAP_ARCHIVE, region_id)).data, ref.file_ids
            )
            terrain = decode_terrain(files[TERRAIN_FILE])
        except Exception as exc:
            failed += 1
            if failed <= 3:
                logger.warning("Failed to decode map region {}: {}", region_id, exc)
            continue

        terrain_planes += _add_region(session, cache_build_id, region_id, terrain)
        squares += 1

        if LOCATIONS_FILE in files:
            try:
                locations += _collect_locations(
                    cache_build_id, region_id, files[LOCATIONS_FILE], pending
                )
            except Exception as exc:
                failed += 1
                if failed <= 3:
                    logger.warning(
                        "Failed to decode locations for region {}: {}", region_id, exc
                    )
        if len(pending) >= _COPY_CHUNK:
            await _copy_locations(session, pending)
            pending = []

    await session.flush()
    await _copy_locations(session, pending)
    logger.info(
        "Ingested maps: {} squares, {} terrain planes, {} locations ({} regions failed)",
        squares,
        terrain_planes,
        locations,
        failed,
    )


def _add_region(
    session: AsyncSession, cache_build_id: int, region_id: int, terrain: object
) -> int:
    region_x, region_y = region_coords(region_id)
    plane_mask = 0
    added = 0
    for plane in range(PLANES):
        if plane_is_empty(terrain, plane):  # type: ignore[arg-type]
            continue
        plane_mask |= 1 << plane
        session.add(
            MapTerrain(
                cache_build_id=cache_build_id,
                region_id=region_id,
                plane=plane,
                data=pack_terrain(terrain, plane),  # type: ignore[arg-type]
            )
        )
        added += 1

    session.add(
        MapSquare(
            cache_build_id=cache_build_id,
            region_id=region_id,
            region_x=region_x,
            region_y=region_y,
            plane_mask=plane_mask,
        )
    )
    return added


def _collect_locations(
    cache_build_id: int, region_id: int, data: bytes, out: list[LocationRecord]
) -> int:
    base_x, base_y = region_base(region_id)
    count = 0
    for loc in decode_locations(data):
        out.append(
            (
                cache_build_id,
                region_id,
                loc.object_id,
                loc.plane,
                base_x + loc.local_x,
                base_y + loc.local_y,
                loc.shape,
                loc.orientation,
            )
        )
        count += 1
    return count


async def _copy_locations(session: AsyncSession, records: list[LocationRecord]) -> None:
    if not records:
        return
    connection = await session.connection()
    raw = await connection.get_raw_connection()
    asyncpg_connection = raw.driver_connection
    await asyncpg_connection.copy_records_to_table(  # type: ignore[union-attr]
        "map_locations", records=records, columns=_LOCATION_COLUMNS
    )
