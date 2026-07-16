"""Tile-scheme geometry tests - the coordinate maths that, if wrong, mirror or offset
the whole map without any error."""

from __future__ import annotations

import numpy as np

from app.config import MAP_BASE_ZOOM, MAP_TILE_SIZE
from app.maps.tiles import (
    WORLD_TILES,
    base_tiles_for_region,
    cut_base_canvas,
    parent_tiles,
    zoom_levels,
)

_SUB = 2 ** (MAP_BASE_ZOOM - 2) * 64 // MAP_TILE_SIZE


def test_a_region_is_a_2x2_block_of_base_tiles() -> None:
    tiles = base_tiles_for_region(50, 50)
    assert len(tiles) == _SUB * _SUB == 4
    xs = {tx for _, _, tx, _ in tiles}
    ys = {ty for _, _, _, ty in tiles}
    assert xs == {100, 101}
    assert ys == {410, 411}


def test_region_x_maps_straight_to_tile_columns() -> None:
    for region_x in (0, 15, 50, 200):
        tiles = base_tiles_for_region(region_x, 40)
        assert min(tx for _, _, tx, _ in tiles) == region_x * _SUB


def test_north_is_up_higher_region_y_is_a_smaller_tile_y() -> None:
    """XYZ y grows south. A region further north must land on a lower tile-y row, or the
    map renders upside down."""
    south = base_tiles_for_region(50, 40)
    north = base_tiles_for_region(50, 41)
    assert max(ty for _, _, _, ty in north) < min(ty for _, _, _, ty in south)


def test_base_grid_spans_the_world() -> None:
    top_left = base_tiles_for_region(0, 255)
    assert min(ty for _, _, _, ty in top_left) == 0
    per_axis = WORLD_TILES * (2 ** (MAP_BASE_ZOOM - 2)) // MAP_TILE_SIZE
    bottom = base_tiles_for_region(0, 0)
    assert max(ty for _, _, _, ty in bottom) == per_axis - 1


def test_cut_skips_transparent_tiles() -> None:
    canvas = np.zeros((_SUB * MAP_TILE_SIZE, _SUB * MAP_TILE_SIZE, 4), dtype=np.uint8)
    canvas[0:MAP_TILE_SIZE, 0:MAP_TILE_SIZE, 3] = 255  # only one sub-tile has content
    tiles = cut_base_canvas(canvas, 50, 50)
    assert len(tiles) == 1


def test_parent_tiles_halve_coordinates() -> None:
    assert parent_tiles({(100, 410), (101, 411)}) == {(50, 205)}
    assert parent_tiles({(0, 0), (1, 1), (2, 2)}) == {(0, 0), (1, 1)}


def test_zoom_levels_run_from_base_down_to_min() -> None:
    zooms = list(zoom_levels())
    assert zooms[0] == MAP_BASE_ZOOM
    assert zooms[-1] == 0
    assert zooms == sorted(zooms, reverse=True)
