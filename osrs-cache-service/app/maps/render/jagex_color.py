"""Jagex's full-precision HSL colour space, as used by the map renderer.

Ported from RuneLite's ``net.runelite.cache.models.JagexColor`` plus the
``calculateHsl`` methods on ``UnderlayDefinition`` / ``OverlayDefinition``.

This is *not* the 16-bit HSL of `app/models/colors.py`, which the item renderer uses
(6 bits hue, 3 saturation, 7 luminance). The map uses the "full" 8/8/8 packing and a
different RGB conversion with no brightness gamma. Keep the two apart.

The underlay's ``hue`` is stored **pre-multiplied by hue_multiplier** - that is what
makes the blend in `blend.py` a weighted average rather than a flat one. The overlay's
is not.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True, slots=True)
class Hsl:
    hue: int
    saturation: int
    lightness: int
    hue_multiplier: int


def _clamp_byte(value: int) -> int:
    return max(0, min(255, value))


def _rgb_to_hsl_floats(rgb: int) -> tuple[float, float, float]:
    red = ((rgb >> 16) & 0xFF) / 256.0
    green = ((rgb >> 8) & 0xFF) / 256.0
    blue = (rgb & 0xFF) / 256.0

    low = min(red, green, blue)
    high = max(red, green, blue)

    hue = 0.0
    saturation = 0.0
    lightness = (low + high) / 2.0

    if low != high:
        if lightness < 0.5:
            saturation = (high - low) / (high + low)
        else:
            saturation = (high - low) / (2.0 - high - low)

        if high == red:
            hue = (green - blue) / (high - low)
        elif high == green:
            hue = 2.0 + (blue - red) / (high - low)
        else:
            hue = 4.0 + (red - green) / (high - low)

    return hue / 6.0, saturation, lightness


def underlay_hsl(rgb: int) -> Hsl:
    hue, saturation, lightness = _rgb_to_hsl_floats(rgb)

    if lightness > 0.5:
        multiplier = int(saturation * (1.0 - lightness) * 512.0)
    else:
        multiplier = int(saturation * lightness * 512.0)
    multiplier = max(1, multiplier)

    return Hsl(
        hue=int(multiplier * hue),
        saturation=_clamp_byte(int(saturation * 256.0)),
        lightness=_clamp_byte(int(lightness * 256.0)),
        hue_multiplier=multiplier,
    )


def overlay_hsl(rgb: int) -> Hsl:
    hue, saturation, lightness = _rgb_to_hsl_floats(rgb)
    return Hsl(
        hue=_clamp_byte(int(hue * 256.0)),
        saturation=_clamp_byte(int(saturation * 256.0)),
        lightness=_clamp_byte(int(lightness * 256.0)),
        hue_multiplier=1,
    )


def adjust_lightness(hsl: Hsl) -> Hsl:
    """The x0.898 darkening the map dumper applies to every overlay colour."""
    lightness = int(hsl.lightness * 0.898)
    lightness = max(2, min(255, lightness))
    return Hsl(hsl.hue, hsl.saturation, lightness, hsl.hue_multiplier)


def hsl_to_rgb(
    hue: np.ndarray, saturation: np.ndarray, lightness: np.ndarray
) -> np.ndarray:
    """Vectorized HSLtoRGBFull. Inputs are 0-255 arrays; returns uint8 [..., 3]."""
    h = hue.astype(np.float64) / 256.0
    s = saturation.astype(np.float64) / 256.0
    lum = lightness.astype(np.float64) / 256.0

    chroma = (1.0 - np.abs(2.0 * lum - 1.0)) * s
    x = chroma * (1.0 - np.abs(np.mod(h * 6.0, 2.0) - 1.0))
    base = lum - chroma / 2.0

    sector = (h * 6.0).astype(np.int64)
    red = base.copy()
    green = base.copy()
    blue = base.copy()

    for index, (dr, dg, db) in enumerate(
        [(chroma, x, 0), (x, chroma, 0), (0, chroma, x), (0, x, chroma), (x, 0, chroma)]
    ):
        mask = sector == index
        red[mask] += dr[mask] if isinstance(dr, np.ndarray) else dr
        green[mask] += dg[mask] if isinstance(dg, np.ndarray) else dg
        blue[mask] += db[mask] if isinstance(db, np.ndarray) else db

    rest = sector >= 5
    red[rest] += chroma[rest]
    blue[rest] += x[rest]

    stacked = np.stack([red, green, blue], axis=-1)
    return (stacked * 256.0).astype(np.int64).clip(0, 255).astype(np.uint8)
