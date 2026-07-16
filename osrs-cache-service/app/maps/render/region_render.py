"""Rasterizes one region-plane to an RGBA image.

Ported from the tile loop in RuneLite's ``MapImageDumper.drawMap``. A tile is either
all underlay (no overlay), all overlay (shape 1), or split by one of the 8 generated
shape masks. The awkward ``shape--`` before the mask lookup is Jagex's, not a bug.

Game y grows north but image rows grow downward, so the row is ``63 - y``. That flip
happens here and nowhere else.

There is no height shading - MapImageDumper has none, and the OSRS Wiki's map is
generated from exactly this. Textured overlays *are* coloured, but from the texture's
stored average HSL rather than by sampling the texture image (see `palette.py`).
"""

from __future__ import annotations

import numpy as np

from app.maps.constants import REGION_SIZE
from app.maps.render.blend import blend_underlay
from app.maps.render.jagex_color import hsl_to_rgb
from app.maps.render.palette import FloorPalette
from app.maps.render.shapes import tile_shapes

_ID_MASK = 0x7FFF
_FULL_OVERLAY_SHAPE = 1


def _convert_rotation(rotation: np.ndarray, shape: np.ndarray) -> np.ndarray:
    rotated = np.where(shape == 9, (rotation + 1) & 3, rotation)
    return np.where((shape == 10) | (shape == 11), (rotation + 3) & 3, rotated)


def _convert_shape(shape: np.ndarray) -> np.ndarray:
    converted = np.where((shape == 9) | (shape == 10), 1, shape)
    return np.where(shape == 11, 8, converted)


def _tile_colors(
    terrain: np.ndarray, padded_underlay_ids: np.ndarray, palette: FloorPalette
) -> tuple[np.ndarray, np.ndarray]:
    underlay_id = terrain["underlay_id"].astype(np.int64) & _ID_MASK
    overlay_id = terrain["overlay_id"].astype(np.int64) & _ID_MASK

    blended = blend_underlay(padded_underlay_ids, palette.underlay)
    lightness = np.clip(blended.lightness, 0, 255)
    rgb = hsl_to_rgb(blended.hue, blended.saturation, lightness)

    underlay = np.zeros((REGION_SIZE, REGION_SIZE, 4), dtype=np.uint8)
    draws_underlay = (underlay_id > 0) & blended.present
    underlay[..., :3] = rgb
    underlay[..., 3] = np.where(draws_underlay, 255, 0)

    overlay_index = np.clip(overlay_id - 1, 0, palette.overlay_rgb.shape[0] - 1)
    overlay = np.zeros((REGION_SIZE, REGION_SIZE, 4), dtype=np.uint8)
    draws_overlay = (overlay_id > 0) & palette.overlay_drawn[overlay_index]
    overlay[..., :3] = palette.overlay_rgb[overlay_index]
    overlay[..., 3] = np.where(draws_overlay, 255, 0)

    return underlay, overlay


def _expand(tiles: np.ndarray, scale: int) -> np.ndarray:
    """Turns a (64, 64, 4) per-tile array into a full canvas, flipping y to rows."""
    rows = np.flip(tiles.transpose(1, 0, 2), axis=0)
    return np.repeat(np.repeat(rows, scale, axis=0), scale, axis=1)


def render_region_plane(
    terrain: np.ndarray,
    padded_underlay_ids: np.ndarray,
    palette: FloorPalette,
    scale: int,
) -> np.ndarray:
    """Returns a (64 * scale, 64 * scale, 4) RGBA canvas for one region-plane."""
    underlay, overlay = _tile_colors(terrain, padded_underlay_ids, palette)

    overlay_id = terrain["overlay_id"].astype(np.int64) & _ID_MASK
    raw_shape = np.where(
        overlay_id > 0, terrain["overlay_path"].astype(np.int64) + 1, 0
    )
    rotation = terrain["overlay_rotation"].astype(np.int64)

    full_overlay = (raw_shape == _FULL_OVERLAY_SHAPE)[..., None]
    flat = np.where(full_overlay, overlay, underlay)
    canvas = _expand(flat, scale)

    split = raw_shape >= 2
    if split.any():
        _draw_split_tiles(
            canvas, underlay, overlay, raw_shape - 1, rotation, split, scale
        )
    return canvas


def _draw_split_tiles(
    canvas: np.ndarray,
    underlay: np.ndarray,
    overlay: np.ndarray,
    shape: np.ndarray,
    rotation: np.ndarray,
    split: np.ndarray,
    scale: int,
) -> None:
    masks = tile_shapes(scale)
    converted_rotation = _convert_rotation(rotation, shape)
    converted_shape = _convert_shape(shape)

    offsets = np.arange(scale)
    for shape_id in range(1, 9):
        for rotation_id in range(4):
            selected = (
                split
                & (converted_shape == shape_id)
                & (converted_rotation == rotation_id)
            )
            if not selected.any():
                continue

            mask = masks[shape_id - 1, rotation_id].astype(bool)
            tiles = np.argwhere(selected)
            over = overlay[selected][:, None, None, :]
            under = underlay[selected][:, None, None, :]
            blocks = np.where(mask[None, :, :, None], over, under)

            rows = (REGION_SIZE - 1 - tiles[:, 1])[:, None, None] * scale + offsets[
                None, :, None
            ]
            columns = tiles[:, 0][:, None, None] * scale + offsets[None, None, :]
            canvas[rows, columns] = blocks
