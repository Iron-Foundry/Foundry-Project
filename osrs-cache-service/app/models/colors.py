"""HSL16 -> RGB conversion and directional Gouraud lighting for 3D model faces.

Ported from osrs-clansocket/clansocket-osrs-cache-extractor
(github.com/osrs-clansocket/clansocket-osrs-cache-extractor) - the only
open-source project found that actually replicates the classic client's flat
2D item-icon renderer end to end (`ItemLighter.java`, `ColorPalette.java`),
rather than just loading models for 3D export/tooling like RuneLite's cache
module or Dezinater/osrscachereader. Cross-checked against both of those for
the parts they do cover (base HSL->RGB shape); the gamma constant (0.85) and
lighting formula below are unique to that project and explicitly labelled by
its author as the "authentic-OSRS variant", since producing accurate 2D icons
is that codebase's actual purpose.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

from app.models.definition import compute_face_normal

_GAMMA = 0.85
_HUE_OFFSET = 0.5 / 64
_SATURATION_OFFSET = 0.5 / 8
_SATURATION_SCALE = 0.8

_LIGHT_X, _LIGHT_Y, _LIGHT_Z = -50, -10, -50
_LIGHT_MAG = int(math.sqrt(_LIGHT_X**2 + _LIGHT_Y**2 + _LIGHT_Z**2))

AMBIENT_BASE = 64
CONTRAST_BASE = 768
_LUMINANCE_MIN = 2
_LUMINANCE_MAX = 126
_HUESAT_MASK = 0xFF80


def _hue_to_channel(p: float, q: float, t: float) -> float:
    t %= 1.0
    if t < 1 / 6:
        return p + (q - p) * 6 * t
    if t < 1 / 2:
        return q
    if t < 2 / 3:
        return p + (q - p) * (2 / 3 - t) * 6
    return p


def _hsl_to_rgb01(h: float, s: float, lightness: float) -> tuple[float, float, float]:
    if s == 0:
        return lightness, lightness, lightness
    q = lightness * (1 + s) if lightness < 0.5 else lightness + s - lightness * s
    p = 2 * lightness - q
    return (
        _hue_to_channel(p, q, h + 1 / 3),
        _hue_to_channel(p, q, h),
        _hue_to_channel(p, q, h - 1 / 3),
    )


def _build_table() -> list[int]:
    table = [0] * 65536
    for hue in range(64):
        h = hue / 64.0 + _HUE_OFFSET
        for sat in range(8):
            s = min(1.0, (sat / 8.0 + _SATURATION_OFFSET) * _SATURATION_SCALE)
            for light in range(128):
                lightness = light / 128.0
                r, g, b = _hsl_to_rgb01(h, s, lightness)
                r = max(0.0, min(1.0, r)) ** _GAMMA
                g = max(0.0, min(1.0, g)) ** _GAMMA
                b = max(0.0, min(1.0, b)) ** _GAMMA
                idx = (hue << 10) | (sat << 7) | light
                table[idx] = (
                    (min(255, int(r * 256)) << 16)
                    | (min(255, int(g * 256)) << 8)
                    | min(255, int(b * 256))
                )
    return table


_TABLE = _build_table()


def hsl_to_rgb(hsl: int) -> tuple[int, int, int]:
    packed = _TABLE[hsl & 0xFFFF]
    return (packed >> 16) & 0xFF, (packed >> 8) & 0xFF, packed & 0xFF


def apply_recolor(
    face_colors: list[int],
    color_find: list[int] | None,
    color_replace: list[int] | None,
) -> list[int]:
    if not color_find or not color_replace:
        return face_colors
    mapping = dict(zip(color_find, color_replace))
    return [mapping.get(c, c) for c in face_colors]


def _var7(contrast_total: int) -> int:
    return (_LIGHT_MAG * contrast_total) >> 8


def _trunc_div(a: float, b: float) -> int:
    """Java integer/long division truncates toward zero, unlike Python's floor //."""
    return int(a / b)


def _modulate_luminance(hsl: int, factor: int) -> int:
    """Multiplies the base color's own lightness by `factor` (not a replacement) -
    a color that's naturally dark stays proportionally dark under bright light."""
    adjusted = ((hsl & 127) * factor) // 128
    adjusted = max(_LUMINANCE_MIN, min(_LUMINANCE_MAX, adjusted))
    return (hsl & _HUESAT_MASK) | adjusted


def _vertex_lit_hsl(
    hsl: int,
    nx: float,
    ny: float,
    nz: float,
    count: int,
    var7: int,
    ambient: int,
    back: bool = False,
) -> int:
    if count <= 0 or var7 <= 0:
        return hsl
    dot = _LIGHT_X * nx + _LIGHT_Y * ny + _LIGHT_Z * nz
    if back:
        dot = -dot
    factor = _trunc_div(dot, var7 * count) + ambient
    return _modulate_luminance(hsl, factor)


def _bound_2_126(value: int) -> int:
    if value < _LUMINANCE_MIN:
        return _LUMINANCE_MIN
    if value > _LUMINANCE_MAX:
        return _LUMINANCE_MAX
    return value


def _vertex_lightness(
    nx: float,
    ny: float,
    nz: float,
    count: int,
    var7: int,
    ambient: int,
    back: bool = False,
) -> int:
    """The raw 2..126 lightness a textured face vertex is modulated by - the
    same directional term as `_vertex_lit_hsl` but *without* folding in a base
    colour's own lightness, matching RuneLite's `bound2to126(...)` branch for
    textured faces (the texel itself supplies the colour). ``back`` negates the
    light dot for the back side of the face (clansocket's dual-side lighting)."""
    if count <= 0 or var7 <= 0:
        return _bound_2_126(ambient)
    dot = _LIGHT_X * nx + _LIGHT_Y * ny + _LIGHT_Z * nz
    if back:
        dot = -dot
    return _bound_2_126(_trunc_div(dot, var7 * count) + ambient)


def compute_face_texture_lightness(
    face_a: list[int],
    face_b: list[int],
    face_c: list[int],
    face_render_types: list[int] | None,
    is_textured: list[bool],
    vertex_x: Sequence[float],
    vertex_y: Sequence[float],
    vertex_z: Sequence[float],
    normal_x: Sequence[float],
    normal_y: Sequence[float],
    normal_z: Sequence[float],
    normal_n: Sequence[int],
    ambient: int,
    contrast: int,
) -> tuple[list[int], list[int], list[int], list[int], list[int], list[int]]:
    """Per-vertex 2..126 lightness for each textured face, front and back sides
    (0 for non-textured faces). The rasterizer multiplies the texel by the
    front lightness on a front-facing triangle, the back on a back-facing one -
    clansocket's `gl_FrontFacing` selection. Flat faces (render_type 1) use the
    face normal and `var7_flat`."""
    var7 = _var7(contrast)
    var7_flat = var7 + (var7 >> 1)

    face_count = len(face_a)
    light_a = [0] * face_count
    light_b = [0] * face_count
    light_c = [0] * face_count
    back_a = [0] * face_count
    back_b = [0] * face_count
    back_c = [0] * face_count

    for f in range(face_count):
        if not is_textured[f]:
            continue
        a, b, c = face_a[f], face_b[f], face_c[f]
        if face_render_types is not None and face_render_types[f] == 1:
            nx, ny, nz = compute_face_normal(vertex_x, vertex_y, vertex_z, a, b, c)
            light_a[f] = light_b[f] = light_c[f] = _vertex_lightness(
                nx, ny, nz, 1, var7_flat, ambient
            )
            back_a[f] = back_b[f] = back_c[f] = _vertex_lightness(
                nx, ny, nz, 1, var7_flat, ambient, back=True
            )
            continue
        for face_vertex, front_list, back_list in (
            (a, light_a, back_a),
            (b, light_b, back_b),
            (c, light_c, back_c),
        ):
            front_list[f] = _vertex_lightness(
                normal_x[face_vertex],
                normal_y[face_vertex],
                normal_z[face_vertex],
                normal_n[face_vertex],
                var7,
                ambient,
            )
            back_list[f] = _vertex_lightness(
                normal_x[face_vertex],
                normal_y[face_vertex],
                normal_z[face_vertex],
                normal_n[face_vertex],
                var7,
                ambient,
                back=True,
            )

    return light_a, light_b, light_c, back_a, back_b, back_c


def compute_face_lit_colors(
    face_a: list[int],
    face_b: list[int],
    face_c: list[int],
    face_colors: list[int],
    face_render_types: list[int] | None,
    vertex_x: Sequence[float],
    vertex_y: Sequence[float],
    vertex_z: Sequence[float],
    normal_x: Sequence[float],
    normal_y: Sequence[float],
    normal_z: Sequence[float],
    normal_n: Sequence[int],
    ambient: int,
    contrast: int,
) -> tuple[
    list[tuple[int, int, int]],
    list[tuple[int, int, int]],
    list[tuple[int, int, int]],
    list[tuple[int, int, int]],
    list[tuple[int, int, int]],
    list[tuple[int, int, int]],
]:
    """Per-face lit RGB for each of its 3 vertices, front and back sides - real
    ambient/contrast/light-vector Gouraud formula (`ItemLighter.applyLighting`).
    The back side negates the light dot, so a face that turns away from the
    camera is still lit correctly; the rasterizer picks front or back per
    triangle by its projected winding (clansocket's `gl_FrontFacing`). Flat-
    shaded faces (render_type 1) use a single face normal, one colour per side."""
    var7 = _var7(contrast)
    var7_flat = var7 + (var7 >> 1)

    face_count = len(face_a)
    lit_a: list[tuple[int, int, int]] = [(0, 0, 0)] * face_count
    lit_b: list[tuple[int, int, int]] = [(0, 0, 0)] * face_count
    lit_c: list[tuple[int, int, int]] = [(0, 0, 0)] * face_count
    back_a: list[tuple[int, int, int]] = [(0, 0, 0)] * face_count
    back_b: list[tuple[int, int, int]] = [(0, 0, 0)] * face_count
    back_c: list[tuple[int, int, int]] = [(0, 0, 0)] * face_count

    for f in range(face_count):
        a, b, c = face_a[f], face_b[f], face_c[f]
        hsl = face_colors[f]
        is_flat = face_render_types is not None and face_render_types[f] == 1

        if is_flat:
            nx, ny, nz = compute_face_normal(vertex_x, vertex_y, vertex_z, a, b, c)
            dot = _LIGHT_X * nx + _LIGHT_Y * ny + _LIGHT_Z * nz
            front_factor = (
                (_trunc_div(dot, var7_flat) + ambient) if var7_flat > 0 else ambient
            )
            back_factor = (
                (_trunc_div(-dot, var7_flat) + ambient) if var7_flat > 0 else ambient
            )
            lit_a[f] = lit_b[f] = lit_c[f] = hsl_to_rgb(
                _modulate_luminance(hsl, front_factor)
            )
            back_a[f] = back_b[f] = back_c[f] = hsl_to_rgb(
                _modulate_luminance(hsl, back_factor)
            )
            continue

        for face_vertex, front_list, back_list in (
            (a, lit_a, back_a),
            (b, lit_b, back_b),
            (c, lit_c, back_c),
        ):
            front_list[f] = hsl_to_rgb(
                _vertex_lit_hsl(
                    hsl,
                    normal_x[face_vertex],
                    normal_y[face_vertex],
                    normal_z[face_vertex],
                    normal_n[face_vertex],
                    var7,
                    ambient,
                )
            )
            back_list[f] = hsl_to_rgb(
                _vertex_lit_hsl(
                    hsl,
                    normal_x[face_vertex],
                    normal_y[face_vertex],
                    normal_z[face_vertex],
                    normal_n[face_vertex],
                    var7,
                    ambient,
                    back=True,
                )
            )

    return lit_a, lit_b, lit_c, back_a, back_b, back_c
