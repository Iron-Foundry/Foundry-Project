"""Builds a flat RGB texture image from its backing sprite, for use by the
item-icon texture rasterizer.

A texture (archive 9) in this cache's rev233 format is a single sprite id
(archive 8) plus a brightness/gamma pass - RuneLite's ``TextureDefinition.
method2680`` with ``brightness=0.8``. The multi-sprite recolour transforms of
the older format are absent here, so the whole build reduces to: decode the
sprite, gamma-adjust each channel, and resize to the fixed texture resolution.

Gamma is applied per output pixel rather than per palette entry - identical
result, since the adjustment is a monotonic per-channel power curve and index 0
(transparent) stays black either way.
"""

from __future__ import annotations

import numpy as np

from app.sprites.decoder import SpriteFrame

TEXTURE_RES = 128
_GAMMA = 0.8

_GAMMA_LUT = np.array(
    [min(255, int((c / 256.0) ** _GAMMA * 256.0)) for c in range(256)],
    dtype=np.uint8,
)


def build_texture_image(frame: SpriteFrame) -> np.ndarray:
    """A ``(TEXTURE_RES, TEXTURE_RES, 4)`` uint8 RGBA array for one sprite frame.

    The alpha channel is kept so the rasterizer can discard transparent texels
    the way the client does (many item textures - fishing nets, the magic-log
    sparkle overlay - are mostly transparent, and drawing those texels opaque
    paints them solid black). Gamma is applied only to RGB. Nearest-neighbour
    resample matches the client's own 64->128 doubling / 128->64 decimation.
    """
    pixels = np.frombuffer(frame.rgba, dtype=np.uint8).reshape(
        frame.height, frame.width, 4
    )
    rgba = pixels.copy()
    rgba[..., :3] = _GAMMA_LUT[pixels[..., :3]]
    if frame.width != TEXTURE_RES or frame.height != TEXTURE_RES:
        rows = (np.arange(TEXTURE_RES) * frame.height) // TEXTURE_RES
        cols = (np.arange(TEXTURE_RES) * frame.width) // TEXTURE_RES
        rgba = rgba[rows][:, cols]
    return np.ascontiguousarray(rgba)
