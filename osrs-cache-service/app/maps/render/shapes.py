"""Generates the tile shape masks - the 8 overlay shapes x 4 rotations.

Ported from ``genTileShapes1()``..``genTileShapes8()`` in RuneLite's MapImageDumper.
They are *generated*, not tabulated, because the masks depend on the pixel scale: the
same predicates produce a 4x4 mask at 4 px/tile and a 512x512 one at 512.

Each mask is filled by walking an outer and an inner loop (either forwards or
backwards) and testing a predicate on the two loop counters - the reversal *is* the
rotation. The write index advances monotonically regardless of direction, so the
resulting flat array indexes as [row][column] with row = outer, column = inner, which
is the order the fill loop in `region_render.py` reads it back.

0 means "underlay pixel", 1 means "overlay pixel".
"""

from __future__ import annotations

from collections.abc import Callable
from functools import lru_cache

import numpy as np

SHAPE_COUNT = 8
ROTATION_COUNT = 4

Predicate = Callable[[int, int, int], bool]


def _diagonal_le(a: int, b: int, _scale: int) -> bool:
    return b <= a


def _diagonal_ge(a: int, b: int, _scale: int) -> bool:
    return b >= a


def _half_le(a: int, b: int, _scale: int) -> bool:
    return b <= a >> 1


def _half_ge(a: int, b: int, _scale: int) -> bool:
    return b >= a << 1


def _double_ge(a: int, b: int, _scale: int) -> bool:
    return b >= a >> 1


def _double_le(a: int, b: int, _scale: int) -> bool:
    return b <= a << 1


def _straight_inner_le(a: int, b: int, scale: int) -> bool:
    return b <= scale // 2


def _straight_outer_le(a: int, b: int, scale: int) -> bool:
    return a <= scale // 2


def _straight_inner_ge(a: int, b: int, scale: int) -> bool:
    return b >= scale // 2


def _straight_outer_ge(a: int, b: int, scale: int) -> bool:
    return a >= scale // 2


def _offset_le(a: int, b: int, scale: int) -> bool:
    return b <= a - scale // 2


def _offset_ge(a: int, b: int, scale: int) -> bool:
    return b >= a - scale // 2


# (outer_reversed, inner_reversed, predicate) per shape, per rotation.
_LAYOUT: tuple[tuple[tuple[bool, bool, Predicate], ...], ...] = (
    (
        (False, False, _diagonal_le),
        (True, False, _diagonal_le),
        (False, False, _diagonal_ge),
        (True, False, _diagonal_ge),
    ),
    (
        (True, False, _half_le),
        (False, False, _half_ge),
        (False, True, _half_le),
        (True, True, _half_ge),
    ),
    (
        (True, True, _half_le),
        (True, False, _half_ge),
        (False, False, _half_le),
        (False, True, _half_ge),
    ),
    (
        (True, False, _double_ge),
        (False, False, _double_le),
        (False, True, _double_ge),
        (True, True, _double_le),
    ),
    (
        (True, True, _double_ge),
        (True, False, _double_le),
        (False, False, _double_ge),
        (False, True, _double_le),
    ),
    (
        (False, False, _straight_inner_le),
        (False, False, _straight_outer_le),
        (False, False, _straight_inner_ge),
        (False, False, _straight_outer_ge),
    ),
    (
        (False, False, _offset_le),
        (True, False, _offset_le),
        (True, True, _offset_le),
        (False, True, _offset_le),
    ),
    (
        (False, False, _offset_ge),
        (True, False, _offset_ge),
        (True, True, _offset_ge),
        (False, True, _offset_ge),
    ),
)


def _generate(
    scale: int, outer_reversed: bool, inner_reversed: bool, pred: Predicate
) -> np.ndarray:
    mask = np.zeros(scale * scale, dtype=np.uint8)
    outer = range(scale - 1, -1, -1) if outer_reversed else range(scale)
    inner = range(scale - 1, -1, -1) if inner_reversed else range(scale)

    index = 0
    for a in outer:
        for b in inner:
            if pred(a, b, scale):
                mask[index] = 1
            index += 1

    return mask.reshape(scale, scale)


@lru_cache(maxsize=8)
def tile_shapes(scale: int) -> np.ndarray:
    """Returns a (8, 4, scale, scale) uint8 array of shape masks."""
    if scale < 2:
        raise ValueError("tile shape scale must be at least 2")

    shapes = np.zeros((SHAPE_COUNT, ROTATION_COUNT, scale, scale), dtype=np.uint8)
    for shape, rotations in enumerate(_LAYOUT):
        for rotation, (outer_rev, inner_rev, pred) in enumerate(rotations):
            shapes[shape, rotation] = _generate(scale, outer_rev, inner_rev, pred)
    return shapes


def convert_rotation(rotation: int, shape: int) -> int:
    if shape == 9:
        return (rotation + 1) & 3
    if shape in (10, 11):
        return (rotation + 3) & 3
    return rotation


def convert_shape(shape: int) -> int:
    if shape in (9, 10):
        return 1
    if shape == 11:
        return 8
    return shape
