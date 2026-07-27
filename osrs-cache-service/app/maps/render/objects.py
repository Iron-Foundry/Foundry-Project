"""Draws the object layer over rendered terrain: walls, and map-scene decorations.

Ported from ``drawObjects`` in RuneLite's MapImageDumper. This is what turns a flat
terrain render into a recognisable map - building outlines from wall locations, and the
little tree / rock / stair sprites from objects that carry a map-scene id.

Coordinates match the terrain flip exactly: a location at (local_x, local_y) draws at
column ``local_x * scale`` and row ``(REGION_SIZE - size_y - local_y) * scale`` - north
is up, and multi-tile objects anchor at their northern edge, as in the original.

Objects paint in (local_x, local_y) scan order, matching the original's ``localX``
outer / ``localY`` inner loop. The locations stream arrives object-id-major, so drawing
it as-is would occlude overlapping decorations (dense tree canopies) by id instead of
position; the sort restores the painter order the game uses.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.maps.constants import REGION_SIZE

WALL_COLOR = (238, 238, 238)
DOOR_COLOR = (238, 0, 0)

_WALL_TYPES = (0, 1, 2, 3)
_DIAGONAL_WALL = 9
_SCENE_TYPES = (22, 9, 10, 11)


@dataclass(slots=True, frozen=True)
class ObjectMeta:
    size_y: int
    wall_or_door: int
    map_scene_id: int
    offset_y: int


@dataclass(slots=True, frozen=True)
class PlacedObject:
    object_id: int
    local_x: int
    local_y: int
    shape: int
    orientation: int


def draw_objects(
    canvas: np.ndarray,
    scale: int,
    placed: list[PlacedObject],
    meta: dict[int, ObjectMeta],
    scenes: list[np.ndarray],
) -> None:
    size = REGION_SIZE * scale
    for obj in sorted(placed, key=lambda o: (o.local_x, o.local_y)):
        info = meta.get(obj.object_id)
        if info is None:
            continue
        draw_x = obj.local_x * scale
        if obj.shape in _WALL_TYPES or obj.shape == _DIAGONAL_WALL:
            draw_y = (REGION_SIZE - info.size_y - obj.local_y) * scale
            if info.map_scene_id != -1:
                _blit_scene(canvas, draw_x, draw_y, scale, scenes, info.map_scene_id)
            else:
                _draw_wall(canvas, draw_x, draw_y, scale, size, obj, info)
        elif obj.shape in _SCENE_TYPES and info.map_scene_id != -1:
            draw_y = (REGION_SIZE - max(2, info.offset_y) - obj.local_y) * scale
            _blit_scene(canvas, draw_x, draw_y, scale, scenes, info.map_scene_id)


def _set(
    canvas: np.ndarray, size: int, x: int, y: int, rgb: tuple[int, int, int]
) -> None:
    if 0 <= x < size and 0 <= y < size:
        canvas[y, x, 0] = rgb[0]
        canvas[y, x, 1] = rgb[1]
        canvas[y, x, 2] = rgb[2]
        canvas[y, x, 3] = 255


def _draw_wall(
    canvas: np.ndarray,
    draw_x: int,
    draw_y: int,
    scale: int,
    size: int,
    obj: PlacedObject,
    info: ObjectMeta,
) -> None:
    rgb = DOOR_COLOR if info.wall_or_door != 0 else WALL_COLOR
    rot = obj.orientation
    shape = obj.shape

    if shape in (0, 2):
        x_off = scale - 1 if rot == 2 else 0
        y_off = scale - 1 if rot == 3 else 0
        while x_off < scale and y_off < scale:
            _set(canvas, size, draw_x + x_off, draw_y + y_off, rgb)
            if rot in (0, 2):
                y_off += 1
            else:
                x_off += 1
    if shape == 3:
        corner = {
            0: (0, 0),
            1: (scale - 1, 0),
            2: (scale - 1, scale - 1),
            3: (0, scale - 1),
        }[rot]
        _set(canvas, size, draw_x + corner[0], draw_y + corner[1], rgb)
    if shape == 2:
        x_off = scale - 1 if rot == 1 else 0
        y_off = scale - 1 if rot == 2 else 0
        while x_off < scale and y_off < scale:
            _set(canvas, size, draw_x + x_off, draw_y + y_off, rgb)
            if rot in (1, 3):
                y_off += 1
            else:
                x_off += 1
    if shape == _DIAGONAL_WALL:
        for k in range(scale):
            y = draw_y + (k if rot in (1, 3) else scale - 1 - k)
            _set(canvas, size, draw_x + k, y, rgb)


def _blit_scene(
    canvas: np.ndarray,
    draw_x: int,
    draw_y: int,
    scale: int,
    scenes: list[np.ndarray],
    scene_id: int,
) -> None:
    if scene_id < 0 or scene_id >= len(scenes):
        return
    frame = scenes[scene_id]
    if frame.size == 0:
        return
    size = REGION_SIZE * scale
    y0, x0 = draw_y + scale, draw_x
    frame_h, frame_w = frame.shape[0], frame.shape[1]

    cy0, cy1 = max(0, y0), min(size, y0 + frame_h)
    cx0, cx1 = max(0, x0), min(size, x0 + frame_w)
    if cy0 >= cy1 or cx0 >= cx1:
        return

    sub = frame[cy0 - y0 : cy1 - y0, cx0 - x0 : cx1 - x0]
    mask = sub[..., 3] != 0
    canvas[cy0:cy1, cx0:cx1][mask] = sub[mask]
