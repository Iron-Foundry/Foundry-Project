"""Composites the four rendered planes into the single "ground" overview map.

Ported from the tile loop in RuneLite's ``MapImageDumper.drawMap(image, ..., z=0)``.
The world map the game shows is not any one plane: a tile is drawn at the plane the
player actually stands on there, so bridges and elevated walkways come from plane 1+
while the ground around them stays plane 0. The selection is driven entirely by the
per-tile render-flag byte (``settings``) we already decode and store.

The rule, per tile, drawing later on top (each draw writes only non-transparent
source pixels, exactly like ``drawTile``'s ``argb != 0`` guard):

  isBridge   = settings[1] & 2        -> the surface here is one plane up
  tileZ      = isBridge ? 1 : 0
  if settings[0] & 24 == 0:           # 24 = roof/occlude bits; tile is open to the sky
      if isBridge: draw plane 0       # the bridge underside shows around the deck
      draw plane tileZ                # the walkable surface
  if settings[1] & 8:                 # plane above overhangs and is seen from above
      draw plane tileZ + 1

Masks are built in tile (x, y) space then expanded with the same y-flip the plane
renderer uses, so everything lands on the canvas consistently.
"""

from __future__ import annotations

import numpy as np

from app.maps.constants import PLANES, REGION_SIZE

_ROOF_MASK = 24
_BRIDGE_BIT = 2
_OVERHANG_BIT = 8


def _expand_mask(mask: np.ndarray, scale: int) -> np.ndarray:
    rows = np.flip(mask.T, axis=0)
    return np.repeat(np.repeat(rows, scale, axis=0), scale, axis=1)


def _blit(
    result: np.ndarray, src: np.ndarray | None, tile_mask: np.ndarray, scale: int
) -> None:
    if src is None or not tile_mask.any():
        return
    pixels = _expand_mask(tile_mask, scale) & (src[..., 3] > 0)
    result[pixels] = src[pixels]


def composite_region(
    canvases: dict[int, np.ndarray], settings: np.ndarray, scale: int
) -> np.ndarray:
    """Merges per-plane RGBA canvases into one (64*scale, 64*scale, 4) overview.

    ``canvases`` maps plane -> rendered canvas (missing planes simply absent);
    ``settings`` is the (PLANES, 64, 64) render-flag array.
    """
    size = REGION_SIZE * scale
    result = np.zeros((size, size, 4), dtype=np.uint8)

    s0 = settings[0].astype(np.int64)
    s1 = settings[1].astype(np.int64) if PLANES > 1 else np.zeros_like(s0)
    is_bridge = (s1 & _BRIDGE_BIT) != 0
    base_visible = (s0 & _ROOF_MASK) == 0
    overhang = (s1 & _OVERHANG_BIT) != 0

    # bridge underside, then the walkable surface (plane 0 off a bridge, plane 1 on it)
    _blit(result, canvases.get(0), base_visible & is_bridge, scale)
    _blit(result, canvases.get(0), base_visible & ~is_bridge, scale)
    _blit(result, canvases.get(1), base_visible & is_bridge, scale)

    # the plane above where it overhangs and is visible from directly above
    _blit(result, canvases.get(1), overhang & ~is_bridge, scale)
    _blit(result, canvases.get(2), overhang & is_bridge, scale)

    return result
