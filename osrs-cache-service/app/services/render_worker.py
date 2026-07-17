"""Picklable process-pool target for one on-demand, arbitrary-size item render.

Unlike icon_worker.py (bulk ingest, chunked, per-process geometry cache), this
handles a single ad-hoc request at a time - the size and item vary per call
often enough that a geometry cache would rarely hit, and the DB/file cache in
render_cache.py already covers the "same request twice" case. Must stay
module-level with only primitive/bytes arguments in and out - no ORM objects,
no open file handles, nothing tied to the parent process's event loop.
"""

from __future__ import annotations

import numpy as np

from app.js5.container import decompress
from app.models.loader import decode_model
from app.models.rasterizer import render_icon


def render_item_at_size(
    raw_model_bytes: bytes,
    model_id: int,
    xan2d: int,
    yan2d: int,
    zan2d: int,
    zoom2d: int,
    x_offset2d: int,
    y_offset2d: int,
    resize_x: int | None,
    resize_y: int | None,
    resize_z: int | None,
    ambient: int,
    contrast: int,
    color_find: list[int] | None,
    color_replace: list[int] | None,
    canvas_size: int,
    textures: dict[int, np.ndarray] | None,
) -> bytes:
    model_data = decompress(raw_model_bytes).data
    model = decode_model(model_id, model_data)
    return render_icon(
        model,
        xan2d=xan2d,
        yan2d=yan2d,
        zan2d=zan2d,
        zoom2d=zoom2d,
        x_offset2d=x_offset2d,
        y_offset2d=y_offset2d,
        resize_x=resize_x,
        resize_y=resize_y,
        resize_z=resize_z,
        ambient=ambient,
        contrast=contrast,
        color_find=color_find,
        color_replace=color_replace,
        canvas_size=canvas_size,
        textures=textures,
    )
