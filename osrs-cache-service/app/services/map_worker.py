"""Process-pool target that renders one region-plane and cuts it into base tiles.

The palette is identical for every job and expensive to rebuild, so it is handed to
each worker once through the pool initializer and kept in a module global rather than
pickled with every job. A job then carries only the region's own packed terrain and the
padded underlay window its blend needs - a few tens of KB.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.config import MAP_BASE_ZOOM
from app.maps.constants import MAP_OVERVIEW_PLANE, PLANES, REGION_SIZE
from app.maps.packing import unpack_terrain
from app.maps.render.composite import composite_region
from app.maps.render.objects import ObjectMeta, PlacedObject, draw_objects
from app.maps.render.palette import FloorPalette
from app.maps.render.region_render import render_region_plane
from app.maps.tiles import cut_base_canvas, encode_tile

_BASE_SCALE = 2 ** (MAP_BASE_ZOOM - 2)

_palette: FloorPalette | None = None
_object_meta: dict[int, ObjectMeta] = {}
_scenes: list[np.ndarray] = []


def init_worker(
    palette: FloorPalette,
    object_meta: dict[int, ObjectMeta],
    scenes: list[np.ndarray],
) -> None:
    global _palette, _object_meta, _scenes
    _palette = palette
    _object_meta = object_meta
    _scenes = scenes


@dataclass(slots=True, frozen=True)
class TileJob:
    region_id: int
    region_x: int
    region_y: int
    plane: int
    terrain_blob: bytes
    padded_underlay: np.ndarray
    placed: list[PlacedObject] = field(default_factory=list)


@dataclass(slots=True, frozen=True)
class TileResult:
    plane: int
    tiles: list[tuple[int, int, bytes]]
    error: str | None = None


def render_region_tiles(job: TileJob) -> TileResult:
    if _palette is None:
        return TileResult(
            plane=job.plane, tiles=[], error="worker palette not initialised"
        )
    try:
        terrain = unpack_terrain(job.terrain_blob)
        canvas = render_region_plane(
            terrain, job.padded_underlay, _palette, _BASE_SCALE
        )
        draw_objects(canvas, _BASE_SCALE, job.placed, _object_meta, _scenes)
        cut = cut_base_canvas(canvas, job.region_x, job.region_y)
        tiles = [(tx, ty, encode_tile(block)) for tx, ty, block in cut]
        return TileResult(plane=job.plane, tiles=tiles)
    except Exception as exc:
        return TileResult(plane=job.plane, tiles=[], error=repr(exc))


@dataclass(slots=True, frozen=True)
class CompositeJob:
    region_id: int
    region_x: int
    region_y: int
    terrain_blobs: dict[int, bytes]
    padded_underlays: dict[int, np.ndarray]
    placed: dict[int, list[PlacedObject]] = field(default_factory=dict)


def render_region_composite(job: CompositeJob) -> TileResult:
    if _palette is None:
        return TileResult(
            plane=MAP_OVERVIEW_PLANE, tiles=[], error="worker palette not initialised"
        )
    try:
        settings = np.zeros((PLANES, REGION_SIZE, REGION_SIZE), dtype=np.uint8)
        canvases: dict[int, np.ndarray] = {}
        for plane, blob in job.terrain_blobs.items():
            terrain = unpack_terrain(blob)
            settings[plane] = terrain["settings"]
            canvas = render_region_plane(
                terrain, job.padded_underlays[plane], _palette, _BASE_SCALE
            )
            draw_objects(
                canvas, _BASE_SCALE, job.placed.get(plane, []), _object_meta, _scenes
            )
            canvases[plane] = canvas
        composite = composite_region(canvases, settings, _BASE_SCALE)
        cut = cut_base_canvas(composite, job.region_x, job.region_y)
        tiles = [(tx, ty, encode_tile(block)) for tx, ty, block in cut]
        return TileResult(plane=MAP_OVERVIEW_PLANE, tiles=tiles)
    except Exception as exc:
        return TileResult(plane=MAP_OVERVIEW_PLANE, tiles=[], error=repr(exc))
