"""Per-chunk icon render job, run in a worker process (see ingest_icons.py).

Must stay module-level, picklable, with only primitive/bytes arguments in and
out - no ORM objects, no open file handles/Js5Store, nothing tied to the
parent process's event loop or DB session.

Geometry is cached at module scope (not per-call), keyed on everything that
determines it - model id, resize, rotation. ~70% of items share a full key
with another item (measured against a real cache build - see CLAUDE.md), so
this persists across every chunk a given worker process handles for the
lifetime of the pool, not just within one chunk. Recolor/lighting/rasterize
still run per item since those genuinely vary per item.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from app.js5.container import decompress
from app.models.export import export_icon
from app.models.loader import decode_model
from app.models.rasterizer import (
    PreparedGeometry,
    prepare_geometry,
    render_from_geometry,
)

_geometry_cache: dict[
    tuple[int, int, int, int, int, int, int, int, int, int], PreparedGeometry
] = {}


@dataclass(slots=True, frozen=True)
class IconJob:
    item_id: int
    model_id: int
    raw_model_bytes: bytes
    xan2d: int
    yan2d: int
    zan2d: int
    zoom2d: int
    x_offset2d: int
    y_offset2d: int
    resize_x: int | None
    resize_y: int | None
    resize_z: int | None
    ambient: int
    contrast: int
    color_find: list[int] | None
    color_replace: list[int] | None
    canvas_size: int
    cache_build_id: int


@dataclass(slots=True, frozen=True)
class IconResult:
    item_id: int
    webp_path: str | None
    width: int
    height: int
    error: str | None


@dataclass(slots=True)
class ChunkStats:
    cache_hits: int = 0
    cache_misses: int = 0
    geometry_s: float = 0.0
    render_s: float = 0.0
    encode_s: float = 0.0
    results: list[IconResult] = field(default_factory=list)


def _geometry_key(
    job: IconJob,
) -> tuple[int, int, int, int, int, int, int, int, int, int]:
    return (
        job.model_id,
        job.resize_x or 128,
        job.resize_y or 128,
        job.resize_z or 128,
        job.xan2d,
        job.yan2d,
        job.zan2d,
        job.zoom2d,
        job.x_offset2d,
        job.y_offset2d,
    )


def render_item_icon_chunk(
    jobs: list[IconJob], textures: dict[int, np.ndarray] | None = None
) -> ChunkStats:
    stats = ChunkStats()
    for job in jobs:
        try:
            key = _geometry_key(job)
            geometry = _geometry_cache.get(key)
            if geometry is None:
                t0 = time.monotonic()
                model_data = decompress(job.raw_model_bytes).data
                model = decode_model(job.model_id, model_data)
                geometry = prepare_geometry(
                    model,
                    xan2d=job.xan2d,
                    yan2d=job.yan2d,
                    zan2d=job.zan2d,
                    zoom2d=job.zoom2d,
                    x_offset2d=job.x_offset2d,
                    y_offset2d=job.y_offset2d,
                    resize_x=job.resize_x,
                    resize_y=job.resize_y,
                    resize_z=job.resize_z,
                    canvas_size=job.canvas_size,
                )
                _geometry_cache[key] = geometry
                stats.geometry_s += time.monotonic() - t0
                stats.cache_misses += 1
            else:
                stats.cache_hits += 1

            t0 = time.monotonic()
            canvas = render_from_geometry(
                geometry,
                ambient=job.ambient,
                contrast=job.contrast,
                color_find=job.color_find,
                color_replace=job.color_replace,
                textures=textures,
            )
            stats.render_s += time.monotonic() - t0

            t0 = time.monotonic()
            webp_path = export_icon(
                job.item_id, canvas, job.canvas_size, job.cache_build_id
            )
            stats.encode_s += time.monotonic() - t0

            stats.results.append(
                IconResult(
                    job.item_id, webp_path, job.canvas_size, job.canvas_size, None
                )
            )
        except Exception as exc:
            stats.results.append(IconResult(job.item_id, None, 0, 0, str(exc)))
    return stats
