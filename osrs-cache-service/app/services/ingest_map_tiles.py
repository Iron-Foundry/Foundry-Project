"""Bakes the map tile pyramid for a build: render every region-plane, cut, downsample.

Base tiles come from rendering each region-plane at the base zoom on a process pool
(the render is the same CPU-bound numpy work as item icons, and farms out the same
way). Lower zooms are then built purely from tiles already on disk - each tile is the
2x2 downsample of its four children - so the expensive rendering happens once.

Empty tiles are never written. The set of tiles that do exist per plane is returned so
the manifest's coverage can be derived without walking the volume.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import MAP_BASE_ZOOM, MAPS_DIR
from app.db.models import MapTerrain
from app.definitions.object import decode_object
from app.definitions.registry import CONFIG_ARCHIVE
from app.js5.container import decompress
from app.js5.multifile import split_files
from app.js5.refindex import parse_reference_index
from app.js5.store import Js5Store
from app.maps.constants import (
    LOCATIONS_FILE,
    MAP_ARCHIVE,
    REGION_SIZE,
    region_coords,
    region_id,
)
from app.maps.locations import decode_locations
from app.maps.packing import unpack_terrain
from app.maps.render.blend import BLEND, PADDED_SIZE
from app.maps.render.mapscene import load_map_scenes
from app.maps.render.objects import ObjectMeta, PlacedObject
from app.maps.render.palette import FloorPalette
from app.maps.tiles import (
    build_parent_tile,
    encode_tile,
    parent_tiles,
    write_tile,
    zoom_levels,
)
from app.services.map_palette import build_render_palette
from app.services.map_worker import (
    CompositeJob,
    TileJob,
    TileResult,
    init_worker,
    render_region_composite,
    render_region_tiles,
)

_OBJECT_GROUP = 6
_WORKER_PROCESSES = 4
_YIELD_EVERY = 64
_BASE_SCALE = 2 ** (MAP_BASE_ZOOM - 2)


async def ingest_map_tiles(
    session: AsyncSession, cache_build_id: int, store: Js5Store
) -> None:
    palette = await build_render_palette(session, cache_build_id, store)
    rows = (
        await session.execute(
            select(MapTerrain.region_id, MapTerrain.plane, MapTerrain.data).where(
                MapTerrain.cache_build_id == cache_build_id
            )
        )
    ).all()
    if not rows:
        logger.info("No terrain to bake tiles from for build {}", cache_build_id)
        return

    object_meta = _object_metadata(store)
    scenes = load_map_scenes(store, _BASE_SCALE)
    placements = _placements(store)
    logger.info(
        "Object layer: {} object defs, {} map scenes", len(object_meta), len(scenes)
    )

    blobs = {(r.region_id, r.plane): r.data for r in rows}
    underlays = {
        key: unpack_terrain(data)["underlay_id"].astype(np.int64)
        for key, data in blobs.items()
    }
    jobs = [
        TileJob(
            region_id=rid,
            region_x=region_coords(rid)[0],
            region_y=region_coords(rid)[1],
            plane=plane,
            terrain_blob=blobs[(rid, plane)],
            padded_underlay=_padded_underlay(rid, plane, underlays),
            placed=placements.get((rid, plane), []),
        )
        for (rid, plane) in blobs
    ]

    region_planes: dict[int, list[int]] = defaultdict(list)
    for rid, plane in blobs:
        region_planes[rid].append(plane)
    composite_jobs = [
        CompositeJob(
            region_id=rid,
            region_x=region_coords(rid)[0],
            region_y=region_coords(rid)[1],
            terrain_blobs={p: blobs[(rid, p)] for p in planes},
            padded_underlays={p: _padded_underlay(rid, p, underlays) for p in planes},
            placed={p: placements.get((rid, p), []) for p in planes},
        )
        for rid, planes in region_planes.items()
    ]

    coverage = await _render_pass(
        cache_build_id, palette, object_meta, scenes, jobs, render_region_tiles
    )
    overview = await _render_pass(
        cache_build_id,
        palette,
        object_meta,
        scenes,
        composite_jobs,
        render_region_composite,
    )
    coverage.update(overview)
    total = _build_pyramids(cache_build_id, coverage)
    logger.info(
        "Baked map tiles for build {}: {} planes, {} tiles total",
        cache_build_id,
        len(coverage),
        total,
    )


def _padded_underlay(
    rid: int, plane: int, underlays: dict[tuple[int, int], np.ndarray]
) -> np.ndarray:
    region_x, region_y = region_coords(rid)
    pad = np.zeros((PADDED_SIZE, PADDED_SIZE), dtype=np.int64)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            neighbour = underlays.get((region_id(region_x + dx, region_y + dy), plane))
            if neighbour is None:
                continue
            x0, y0 = dx * REGION_SIZE + BLEND, dy * REGION_SIZE + BLEND
            sx0, sx1 = max(0, x0), min(PADDED_SIZE, x0 + REGION_SIZE)
            sy0, sy1 = max(0, y0), min(PADDED_SIZE, y0 + REGION_SIZE)
            if sx0 >= sx1 or sy0 >= sy1:
                continue
            pad[sx0:sx1, sy0:sy1] = neighbour[sx0 - x0 : sx1 - x0, sy0 - y0 : sy1 - y0]
    return pad


def _object_metadata(store: Js5Store) -> dict[int, ObjectMeta]:
    ref = {
        g.group_id: g
        for g in parse_reference_index(decompress(store.read(255, CONFIG_ARCHIVE)).data)
    }
    files = split_files(
        decompress(store.read(CONFIG_ARCHIVE, _OBJECT_GROUP)).data,
        ref[_OBJECT_GROUP].file_ids,
    )
    meta: dict[int, ObjectMeta] = {}
    for object_id, data in files.items():
        try:
            decoded = decode_object(object_id, data)
        except Exception as exc:
            logger.debug("Skipping undecodable object {}: {}", object_id, exc)
            continue
        meta[object_id] = ObjectMeta(
            size_y=decoded.size_y,
            wall_or_door=decoded.wall_or_door,
            map_scene_id=decoded.map_scene_id,
            offset_y=decoded.offset_y,
        )
    return meta


def _placements(store: Js5Store) -> dict[tuple[int, int], list[PlacedObject]]:
    ref = {
        g.group_id: g
        for g in parse_reference_index(decompress(store.read(255, MAP_ARCHIVE)).data)
    }
    out: dict[tuple[int, int], list[PlacedObject]] = defaultdict(list)
    for region, group in ref.items():
        try:
            files = split_files(
                decompress(store.read(MAP_ARCHIVE, region)).data, group.file_ids
            )
            if LOCATIONS_FILE not in files:
                continue
            locations = decode_locations(files[LOCATIONS_FILE])
        except Exception as exc:
            logger.debug("Skipping undecodable region {}: {}", region, exc)
            continue
        for loc in locations:
            out[(region, loc.plane)].append(
                PlacedObject(
                    object_id=loc.object_id,
                    local_x=loc.local_x,
                    local_y=loc.local_y,
                    shape=loc.shape,
                    orientation=loc.orientation,
                )
            )
    return out


async def _render_pass[JobT](
    cache_build_id: int,
    palette: FloorPalette,
    object_meta: dict[int, ObjectMeta],
    scenes: list[np.ndarray],
    jobs: list[JobT],
    render_fn: Callable[[JobT], TileResult],
) -> dict[int, set[tuple[int, int]]]:
    coverage: dict[int, set[tuple[int, int]]] = defaultdict(set)
    base_zoom = next(iter(zoom_levels()))
    loop = asyncio.get_running_loop()
    start = time.monotonic()
    done = 0
    with ProcessPoolExecutor(
        max_workers=_WORKER_PROCESSES,
        initializer=init_worker,
        initargs=(palette, object_meta, scenes),
    ) as pool:
        futures = [loop.run_in_executor(pool, render_fn, job) for job in jobs]
        for coro in asyncio.as_completed(futures):
            result: TileResult = await coro
            if result.error is not None:
                logger.warning("Tile render failed: {}", result.error)
            for tx, ty, data in result.tiles:
                write_tile(
                    MAPS_DIR, cache_build_id, result.plane, base_zoom, tx, ty, data
                )
                coverage[result.plane].add((tx, ty))
            done += 1
            if done % _YIELD_EVERY == 0:
                logger.info(
                    "Baking base tiles: {}/{} regions ({:.1f}/s)",
                    done,
                    len(jobs),
                    done / max(time.monotonic() - start, 0.001),
                )
    return coverage


def _build_pyramids(
    cache_build_id: int, coverage: dict[int, set[tuple[int, int]]]
) -> int:
    zooms = list(zoom_levels())
    total = 0
    for plane, base_tiles in coverage.items():
        total += len(base_tiles)
        current = base_tiles
        for zoom in zooms[1:]:
            written: set[tuple[int, int]] = set()
            for tx, ty in parent_tiles(current):
                block = build_parent_tile(
                    MAPS_DIR, cache_build_id, plane, zoom + 1, tx, ty
                )
                if block is None or not block[..., 3].any():
                    continue
                write_tile(
                    MAPS_DIR, cache_build_id, plane, zoom, tx, ty, encode_tile(block)
                )
                written.add((tx, ty))
            total += len(written)
            current = written
    return total
