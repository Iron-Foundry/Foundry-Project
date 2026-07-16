"""Precomputes per-definition colour lookups so rendering never touches a def again.

There are only 242 underlays and 640 overlays, but they are consulted once per tile -
19 million times across a full world pass - so they are flattened into arrays indexed
by ``id - 1`` up front.
"""

from __future__ import annotations

from dataclasses import dataclass
from collections.abc import Mapping, Sequence

import numpy as np

from app.definitions.overlay import NO_COLOR, OverlayDefinition
from app.definitions.underlay import UnderlayDefinition
from app.maps.render.blend import UnderlayPalette
from app.maps.render.jagex_color import (
    Hsl,
    adjust_lightness,
    hsl_to_rgb,
    overlay_hsl,
    underlay_hsl,
)


@dataclass(frozen=True, slots=True)
class FloorPalette:
    underlay: UnderlayPalette
    overlay_rgb: np.ndarray
    overlay_drawn: np.ndarray


def _sized(definitions: Sequence[object], attr: str) -> int:
    return max((getattr(d, attr) for d in definitions), default=-1) + 1


def build_palette(
    underlays: Sequence[UnderlayDefinition],
    overlays: Sequence[OverlayDefinition],
    texture_colors: Mapping[int, int] | None = None,
) -> FloorPalette:
    underlay_count = max(_sized(underlays, "id"), 1)
    hue = np.zeros(underlay_count, dtype=np.int64)
    saturation = np.zeros(underlay_count, dtype=np.int64)
    lightness = np.zeros(underlay_count, dtype=np.int64)

    for definition in underlays:
        hsl = underlay_hsl(definition.rgb)
        hue[definition.id] = hsl.hue * 256 // hsl.hue_multiplier
        saturation[definition.id] = hsl.saturation
        lightness[definition.id] = hsl.lightness

    overlay_count = max(_sized(overlays, "id"), 1)
    overlay_rgb = np.zeros((overlay_count, 3), dtype=np.uint8)
    overlay_drawn = np.zeros(overlay_count, dtype=bool)

    for definition in overlays:
        rgb, drawn = _overlay_color(definition, texture_colors or {})
        overlay_rgb[definition.id] = rgb
        overlay_drawn[definition.id] = drawn

    return FloorPalette(
        underlay=UnderlayPalette(hue=hue, saturation=saturation, lightness=lightness),
        overlay_rgb=overlay_rgb,
        overlay_drawn=overlay_drawn,
    )


def _to_rgb(hue: int, saturation: int, lightness: int) -> np.ndarray:
    return hsl_to_rgb(np.array([hue]), np.array([saturation]), np.array([lightness]))[0]


def _texture_hsl(packed: int) -> Hsl:
    """Expands a texture's 16-bit average HSL into the full 8/8/8 space.

    The scaling factors (4, 32, 2) are how MapImageDumper widens the 6/3/7-bit packing.
    """
    return Hsl(
        hue=(packed >> 10 & 63) * 4,
        saturation=(packed >> 7 & 7) * 32,
        lightness=(packed & 127) * 2,
        hue_multiplier=1,
    )


def _overlay_color(
    definition: OverlayDefinition, texture_colors: Mapping[int, int]
) -> tuple[np.ndarray, bool]:
    """Returns the overlay's RGB and whether it draws at all.

    Order matters and is MapImageDumper's: a texture wins over the plain colour, then
    ``0xFF00FF`` means "draw nothing" (the underlay shows through), and a secondary
    colour overrides everything - and, unlike the others, is *not* lightness-adjusted.
    """
    if definition.secondary_rgb != -1:
        hsl = overlay_hsl(definition.secondary_rgb)
        return _to_rgb(hsl.hue, hsl.saturation, hsl.lightness), True

    if definition.texture >= 0:
        packed = texture_colors.get(definition.texture)
        if packed is not None:
            hsl = adjust_lightness(_texture_hsl(packed))
            return _to_rgb(hsl.hue, hsl.saturation, hsl.lightness), True
        if definition.rgb == 0:
            return np.zeros(3, dtype=np.uint8), False

    if definition.rgb == NO_COLOR:
        return np.zeros(3, dtype=np.uint8), False

    hsl = adjust_lightness(overlay_hsl(definition.rgb))
    return _to_rgb(hsl.hue, hsl.saturation, hsl.lightness), True
