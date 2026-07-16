"""Renderer tests: colour conversion, generated shape masks, and the blend window."""

from __future__ import annotations

import numpy as np
import pytest

from app.definitions.overlay import NO_COLOR, OverlayDefinition
from app.definitions.underlay import UnderlayDefinition
from app.maps.constants import REGION_SIZE
from app.maps.render.blend import BLEND, PADDED_SIZE, UnderlayPalette, blend_underlay
from app.maps.render.jagex_color import hsl_to_rgb, overlay_hsl, underlay_hsl
from app.maps.render.palette import build_palette
from app.maps.render.shapes import convert_rotation, convert_shape, tile_shapes


@pytest.mark.parametrize(
    "rgb", [0xAAAAAA, 0x444444, 0x6D5B2B, 0x3D2B0B, 0xB7D49A, 0x445566]
)
def test_overlay_hsl_round_trips_back_to_rgb(rgb: int) -> None:
    """RGB -> HSL -> RGB recovers the colour to within one 8-bit quantization step.

    It is not bit-exact - the intermediate 8/8/8 HSL packing truncates - but this
    matches Java's identical integer truncation, and being off by more than 1 means the
    conversion is wrong rather than merely rounded.
    """
    hsl = overlay_hsl(rgb)
    out = hsl_to_rgb(
        np.array([hsl.hue]), np.array([hsl.saturation]), np.array([hsl.lightness])
    )[0]

    expected = np.array([rgb >> 16 & 0xFF, rgb >> 8 & 0xFF, rgb & 0xFF])
    assert np.abs(out.astype(int) - expected).max() <= 1


def test_underlay_hue_is_premultiplied() -> None:
    """The underlay stores hue x hue_multiplier - that is what weights the blend."""
    hsl = underlay_hsl(0xB7D49A)

    assert hsl.hue_multiplier >= 1
    assert hsl.hue <= hsl.hue_multiplier


def test_tile_shapes_are_generated_per_scale() -> None:
    shapes = tile_shapes(4)

    assert shapes.shape == (8, 4, 4, 4)
    assert set(np.unique(shapes)) <= {0, 1}
    assert tile_shapes(8).shape == (8, 4, 8, 8)


def test_first_shape_is_the_diagonal_split() -> None:
    """Shape 1 rotation 0 fills where column <= row - a lower-triangular half tile."""
    mask = tile_shapes(4)[0, 0]
    expected = np.tril(np.ones((4, 4), dtype=np.uint8))

    assert (mask == expected).all()


def test_shape_rotations_differ() -> None:
    shapes = tile_shapes(4)
    rotations = {shapes[0, r].tobytes() for r in range(4)}

    assert len(rotations) == 4


def test_tile_shapes_rejects_a_scale_below_two() -> None:
    with pytest.raises(ValueError):
        tile_shapes(1)


def test_shape_nine_and_ten_collapse_onto_one() -> None:
    """Jagex folds shapes 9/10/11 back onto 1 and 8 with a rotation fixup."""
    assert convert_shape(9) == 1
    assert convert_shape(10) == 1
    assert convert_shape(11) == 8
    assert convert_shape(5) == 5

    assert convert_rotation(0, 9) == 1
    assert convert_rotation(0, 10) == 3
    assert convert_rotation(0, 11) == 3
    assert convert_rotation(2, 5) == 2


def _flat_palette() -> UnderlayPalette:
    return UnderlayPalette(
        hue=np.array([10, 200], dtype=np.int64),
        saturation=np.array([20, 100], dtype=np.int64),
        lightness=np.array([30, 150], dtype=np.int64),
    )


def test_blend_of_a_uniform_field_returns_that_colour() -> None:
    ids = np.ones((PADDED_SIZE, PADDED_SIZE), dtype=np.int64)
    blended = blend_underlay(ids, _flat_palette())

    assert blended.hue.shape == (REGION_SIZE, REGION_SIZE)
    assert blended.present.all()
    assert (blended.hue == 10).all()
    assert (blended.saturation == 20).all()
    assert (blended.lightness == 30).all()


def test_blend_mixes_two_neighbouring_underlays() -> None:
    """A hard boundary must come out as a gradient, not a step - that blur is the whole
    point of the blend, and it is why a region needs its neighbours loaded."""
    ids = np.ones((PADDED_SIZE, PADDED_SIZE), dtype=np.int64)
    ids[PADDED_SIZE // 2 :, :] = 2
    blended = blend_underlay(ids, _flat_palette())

    distinct = np.unique(blended.hue)
    assert len(distinct) > 2
    assert distinct.min() == 10
    assert distinct.max() == 200


def test_blend_marks_empty_ground_absent() -> None:
    ids = np.zeros((PADDED_SIZE, PADDED_SIZE), dtype=np.int64)
    blended = blend_underlay(ids, _flat_palette())

    assert not blended.present.any()


def test_blend_rejects_an_unpadded_field() -> None:
    with pytest.raises(ValueError):
        blend_underlay(
            np.zeros((REGION_SIZE, REGION_SIZE), dtype=np.int64), _flat_palette()
        )


def test_blend_window_spans_blend_tiles() -> None:
    """A single underlay tile influences a run of BLEND output tiles along each axis.

    The window is the original's asymmetric ``(i - BLEND, i + BLEND]``, so one source at
    the region's edge reaches BLEND tiles into it - which is exactly the reach a region
    needs from each neighbour, and why the render pads by BLEND on every side.
    """
    ids = np.zeros((PADDED_SIZE, PADDED_SIZE), dtype=np.int64)
    ids[BLEND, BLEND] = 1
    blended = blend_underlay(ids, _flat_palette())

    influenced = np.argwhere(blended.present)
    assert influenced[:, 0].max() - influenced[:, 0].min() + 1 == BLEND
    assert influenced[:, 1].max() - influenced[:, 1].min() + 1 == BLEND


def test_no_colour_overlay_does_not_draw() -> None:
    """0xFF00FF is Jagex's "no colour" sentinel: the underlay shows through."""
    palette = build_palette(
        [UnderlayDefinition(id=0, rgb=0x112233)],
        [
            OverlayDefinition(id=0, rgb=NO_COLOR),
            OverlayDefinition(id=1, rgb=0x445566),
        ],
    )

    assert not palette.overlay_drawn[0]
    assert palette.overlay_drawn[1]


def test_textured_overlay_takes_the_texture_average_colour() -> None:
    """Without this a textured overlay has rgb 0 and would punch a hole in the map."""
    definition = OverlayDefinition(id=0, rgb=0, texture=3)

    without = build_palette([], [definition], texture_colors={})
    assert not without.overlay_drawn[0]

    with_texture = build_palette([], [definition], texture_colors={3: 6183})
    assert with_texture.overlay_drawn[0]
    assert with_texture.overlay_rgb[0].any()


def test_secondary_colour_overrides_the_primary() -> None:
    palette = build_palette(
        [], [OverlayDefinition(id=0, rgb=0x111111, secondary_rgb=0x687DAA)]
    )

    assert palette.overlay_drawn[0]
    result = np.array([int(v) for v in palette.overlay_rgb[0]])
    assert np.abs(result - np.array([0x68, 0x7D, 0xAA])).max() <= 1
