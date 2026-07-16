"""XYZ slippy-tile geometry and the pyramid build helpers.

The scheme is absolute and origin-aligned so region boundaries always fall on tile
boundaries: at the base zoom a region is exactly a 2x2 block of 256 px tiles, and every
lower zoom halves the grid. Nothing here depends on which regions happen to exist, so
the same maths runs on the server and (declared through the manifest) on the client.

XYZ y grows downward while game y grows north, so the flip from game space to tile rows
lives in ``base_tiles_for_region`` and nowhere else.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from app.config import MAP_BASE_ZOOM, MAP_MIN_ZOOM, MAP_TILE_SIZE, MAPS_DIR
from app.maps.constants import REGION_SIZE

WORLD_TILES = 256 * REGION_SIZE
_BASE_PPT = 2 ** (MAP_BASE_ZOOM - 2)
_BASE_REGION_PX = REGION_SIZE * _BASE_PPT
_BASE_TILES_PER_AXIS = WORLD_TILES * _BASE_PPT // MAP_TILE_SIZE
_SUB = _BASE_REGION_PX // MAP_TILE_SIZE


def tile_path(
    base_dir: str, build_id: int, plane: int, zoom: int, tx: int, ty: int
) -> Path:
    """Standard nested XYZ layout: <build>/<plane>/<z>/<x>/<y>.webp.

    The nesting matches the URL scheme exactly, so nginx serves a tile straight off the
    volume with a plain ``try_files $uri`` and no rewrite.
    """
    return (
        Path(base_dir) / str(build_id) / str(plane) / str(zoom) / str(tx) / f"{ty}.webp"
    )


def base_tiles_for_region(
    region_x: int, region_y: int
) -> list[tuple[int, int, int, int]]:
    """Base-zoom tiles a region covers, as (sub_col, sub_row, tile_x, tile_y).

    ``sub_col``/``sub_row`` index the 2x2 grid within the region's own base render;
    ``tile_x``/``tile_y`` are absolute XYZ tile coordinates.
    """
    tile_x0 = region_x * _SUB
    tile_y0 = _BASE_TILES_PER_AXIS - (region_y + 1) * _SUB
    return [(i, j, tile_x0 + i, tile_y0 + j) for i in range(_SUB) for j in range(_SUB)]


def cut_base_canvas(
    canvas: np.ndarray, region_x: int, region_y: int
) -> list[tuple[int, int, np.ndarray]]:
    """Splits a region's base render into non-empty 256 px tiles."""
    tiles = []
    for sub_col, sub_row, tx, ty in base_tiles_for_region(region_x, region_y):
        block = canvas[
            sub_row * MAP_TILE_SIZE : (sub_row + 1) * MAP_TILE_SIZE,
            sub_col * MAP_TILE_SIZE : (sub_col + 1) * MAP_TILE_SIZE,
        ]
        if block[..., 3].any():
            tiles.append((tx, ty, block))
    return tiles


def encode_tile(block: np.ndarray) -> bytes:
    from io import BytesIO

    buffer = BytesIO()
    Image.fromarray(block, "RGBA").save(buffer, "WEBP", lossless=True, method=4)
    return buffer.getvalue()


def parent_tiles(child_tiles: set[tuple[int, int]]) -> set[tuple[int, int]]:
    return {(tx // 2, ty // 2) for tx, ty in child_tiles}


def build_parent_tile(
    base_dir: str, build_id: int, plane: int, child_zoom: int, tx: int, ty: int
) -> np.ndarray | None:
    """Downsamples the four zoom+1 children of (tx, ty) into one 256 px tile."""
    combined = np.zeros((MAP_TILE_SIZE * 2, MAP_TILE_SIZE * 2, 4), dtype=np.uint8)
    found = False
    for i in range(2):
        for j in range(2):
            path = tile_path(
                base_dir, build_id, plane, child_zoom, tx * 2 + i, ty * 2 + j
            )
            if not path.is_file():
                continue
            found = True
            child = np.asarray(Image.open(path).convert("RGBA"))
            combined[
                j * MAP_TILE_SIZE : (j + 1) * MAP_TILE_SIZE,
                i * MAP_TILE_SIZE : (i + 1) * MAP_TILE_SIZE,
            ] = child
    if not found:
        return None
    downsized = Image.fromarray(combined, "RGBA").resize(
        (MAP_TILE_SIZE, MAP_TILE_SIZE), Image.Resampling.BOX
    )
    return np.asarray(downsized)


def write_tile(
    base_dir: str, build_id: int, plane: int, zoom: int, tx: int, ty: int, data: bytes
) -> None:
    path = tile_path(base_dir, build_id, plane, zoom, tx, ty)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def zoom_levels() -> range:
    return range(MAP_BASE_ZOOM, MAP_MIN_ZOOM - 1, -1)


def default_base_dir() -> str:
    return MAPS_DIR
