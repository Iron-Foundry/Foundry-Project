"""Blends underlay colours across a sliding window of neighbouring tiles.

The client does not paint a tile's underlay with its own flat colour - it averages the
colours of the tiles around it, which is what gives the ground its soft gradients
instead of hard checkerboard edges. Ported from the blending loop in RuneLite's
``MapImageDumper.drawMap``.

Two details that are easy to get wrong:

- The window is **2 x BLEND wide, not 2 x BLEND + 1**, and it is asymmetric: for output
  tile ``i`` it covers ``(i - BLEND, i + BLEND]``. That falls out of the original's
  running-sum, which adds the tile at ``+BLEND`` and subtracts at ``-BLEND``.
- Hue is accumulated as ``hue * 256 / hue_multiplier``. The underlay definition stores
  hue *pre-multiplied* by that multiplier (see `jagex_color.py`), so this divides it
  back out - saturated colours therefore pull the average harder than washed-out ones.

The window reaches BLEND tiles beyond the region, so a region must be blended with its
neighbours' terrain present or every region border shows a visible seam.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.maps.constants import REGION_SIZE

BLEND = 5
PADDED_SIZE = REGION_SIZE + BLEND * 2


@dataclass(frozen=True, slots=True)
class UnderlayPalette:
    """Per-underlay-id lookup arrays, indexed by ``underlay_id - 1``."""

    hue: np.ndarray
    saturation: np.ndarray
    lightness: np.ndarray

    @property
    def size(self) -> int:
        return int(self.hue.shape[0])


@dataclass(frozen=True, slots=True)
class BlendedUnderlay:
    hue: np.ndarray
    saturation: np.ndarray
    lightness: np.ndarray
    present: np.ndarray


def _window_sum(values: np.ndarray, axis: int) -> np.ndarray:
    """Sums the (i - BLEND, i + BLEND] window over a padded axis of PADDED_SIZE."""
    cumulative = np.cumsum(values, axis=axis, dtype=np.int64)
    zeros = np.zeros_like(np.take(cumulative, [0], axis=axis))
    cumulative = np.concatenate([zeros, cumulative], axis=axis)

    high = np.take(cumulative, range(BLEND * 2 + 1, PADDED_SIZE + 1), axis=axis)
    low = np.take(cumulative, range(1, REGION_SIZE + 1), axis=axis)
    return high - low


def blend_underlay(
    padded_underlay_ids: np.ndarray, palette: UnderlayPalette
) -> BlendedUnderlay:
    """Averages underlay HSL over the blend window.

    ``padded_underlay_ids`` is (PADDED_SIZE, PADDED_SIZE), covering x and y from
    -BLEND to REGION_SIZE + BLEND. Ids are 1-based as stored; 0 means no underlay.
    """
    if padded_underlay_ids.shape != (PADDED_SIZE, PADDED_SIZE):
        raise ValueError(f"expected {PADDED_SIZE}x{PADDED_SIZE} padded underlay ids")

    has_underlay = padded_underlay_ids > 0
    index = np.where(has_underlay, padded_underlay_ids - 1, 0)
    index = np.clip(index, 0, max(palette.size - 1, 0))

    hue = np.where(has_underlay, palette.hue[index], 0)
    saturation = np.where(has_underlay, palette.saturation[index], 0)
    lightness = np.where(has_underlay, palette.lightness[index], 0)
    count = has_underlay.astype(np.int64)

    totals = []
    for channel in (hue, saturation, lightness, count):
        summed = _window_sum(channel.astype(np.int64), axis=0)
        totals.append(_window_sum(summed, axis=1))

    hue_total, saturation_total, lightness_total, number = totals
    present = number > 0
    safe = np.where(present, number, 1)

    return BlendedUnderlay(
        hue=(hue_total // safe).astype(np.int64),
        saturation=(saturation_total // safe).astype(np.int64),
        lightness=(lightness_total // safe).astype(np.int64),
        present=present,
    )
