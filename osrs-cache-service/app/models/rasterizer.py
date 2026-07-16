"""Software rasterizer producing a static 2D inventory icon from a decoded
model + an item's icon "recipe" (rotation/resize/recolor/lighting/texture).

Ported from clansocket's ClanSocketItemSpriteExtractor + GPUIconRenderer
(github.com/osrs-clansocket/clansocket-osrs-cache-extractor), the one open
project that renders correct classic-client item icons end to end:

- **Auto-fit camera.** The model is rotated Z(zan2d) -> X(yan2d) -> Y(xan2d) and
  pushed to a camera distance that makes its rotated bounding box fill the frame
  (focal 32, target 0.85, min depth 100). `zoom2d`/`x_offset2d`/`y_offset2d` are
  NOT read - the reference ignores them, and many items leave `zoom2d` unset,
  which collapsed an earlier zoom2d-driven camera to a blank icon. A final
  alpha-box `_auto_center` recentres the pixels.
- **Textures.** Textured faces are UV-mapped (`_compute_face_uv` +
  `fill_triangle_textured`), each carrying a texture triangle P/M/N; images from
  `texture_image.py`, texel modulated by per-vertex lightness.
- **Hidden surfaces.** Back-face culling (front-facing test in `prepare_geometry`)
  like the classic client, plus a per-pixel z-buffer so overlapping *front* faces
  resolve by depth (priority baked in as `facePriority * 13`). Untextured
  `render_type == 2` faces are dropped (RuneLite `faceColors3 = -2`).
- **Lighting.** Real ambient/contrast/light-vector Gouraud (front and back sides;
  the drawn front faces use the front colour).
- **Transparency.** Two passes: opaque faces write depth, then semi-transparent
  faces blend back-to-front (depth-tested, no write). `faceAlpha == -1` is
  invisible and skipped.

Split into two phases so callers can cache the geometry phase (prepare_geometry)
across the ~70% of items that share a (model, resize, rotation) key - only
recolor + lighting + rasterization vary per item. See icon_worker.py. Triangle
fill is the cost driver at 512x512 - see triangle_fill.py for the numba kernels.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from app.models.colors import (
    AMBIENT_BASE,
    CONTRAST_BASE,
    apply_recolor,
    compute_face_lit_colors,
    compute_face_texture_lightness,
)
from app.models.definition import ModelDefinition, compute_vertex_normals
from app.models.texture_image import TEXTURE_RES as _TEXTURE_RES
from app.models.triangle_fill import fill_triangle, fill_triangle_textured

_ANGLE_UNIT = 2 * math.pi / 2048
# Auto-fit camera (clansocket ClanSocketItemSpriteExtractor): focal 32, the model
# pushed to a camera distance that makes its rotated bounding box fill 0.85 of the
# frame, with a 100-unit minimum so tiny models don't sit on the near plane.
_CLIP_SCALE = 32.0
_TARGET_NDC = 0.85
_MIN_CAMERA_DEPTH = 100.0
_PRIORITY_Z_STEP = 13
_MIN_DEPTH = 1.0
_ALPHA_THRESHOLD = 32
# clansocket's shader discards alpha < 0.01 and treats alpha >= 0.99 as opaque
# (its two passes split there); the rest blend. In 0..255 opacity that is:
_MIN_ALPHA = 3
_OPAQUE_ALPHA = 253


@dataclass(slots=True, frozen=True)
class PreparedGeometry:
    """Everything about a render that depends only on (model, resize, rotation)
    - nothing here depends on an item's recolor table or ambient/contrast."""

    face_a: list[int]
    face_b: list[int]
    face_c: list[int]
    face_colors: list[int]
    face_render_types: list[int] | None
    face_transparencies: list[int] | None
    is_textured: list[bool]
    face_textures: list[int] | None
    face_uv: dict[int, tuple[float, float, float, float, float, float]]
    face_priorities: list[int]
    vertex_x: Sequence[float]
    vertex_y: Sequence[float]
    vertex_z: Sequence[float]
    normal_x: Sequence[float]
    normal_y: Sequence[float]
    normal_z: Sequence[float]
    normal_n: Sequence[int]
    screen_x: list[float]
    screen_y: list[float]
    local_z: list[float]
    face_order: list[int]
    canvas_size: int


def prepare_geometry(
    model: ModelDefinition,
    *,
    xan2d: int,
    yan2d: int,
    zan2d: int,
    zoom2d: int,
    x_offset2d: int,
    y_offset2d: int,
    resize_x: int | None,
    resize_y: int | None,
    resize_z: int | None,
    canvas_size: int = 512,
) -> PreparedGeometry:
    rx = resize_x or 128
    ry = resize_y or 128
    rz = resize_z or 128
    vertex_x = [(v * rx) // 128 for v in model.vertex_x]
    vertex_y = [(v * ry) // 128 for v in model.vertex_y]
    vertex_z = [(v * rz) // 128 for v in model.vertex_z]

    normal_x, normal_y, normal_z, normal_n = compute_vertex_normals(
        vertex_x,
        vertex_y,
        vertex_z,
        model.face_a,
        model.face_b,
        model.face_c,
        model.face_render_types,
    )

    is_textured = [model.is_textured(f) for f in range(model.face_count)]

    # Auto-fit camera, ported from clansocket's ClanSocketItemSpriteExtractor:
    # rotate the model Z(zan2d) -> X(yan2d) -> Y(xan2d), then fit the camera
    # distance to the rotated bounding box so the item fills the frame. zoom2d,
    # x_offset2d and y_offset2d are deliberately NOT read - the reference ignores
    # them, and many items leave zoom2d unset (0), which collapses a
    # zoom2d-driven camera to nothing. The final alpha-box recentre is _auto_center.
    focal = _CLIP_SCALE * canvas_size / 2.0
    center = canvas_size / 2.0

    used_vertices = {
        v
        for f in range(model.face_count)
        for v in (model.face_a[f], model.face_b[f], model.face_c[f])
    }
    if not used_vertices:
        return PreparedGeometry(
            model.face_a,
            model.face_b,
            model.face_c,
            model.face_colors,
            model.face_render_types,
            model.face_transparencies,
            is_textured,
            model.face_textures,
            {},
            [],
            vertex_x,
            vertex_y,
            vertex_z,
            normal_x,
            normal_y,
            normal_z,
            normal_n,
            [],
            [],
            [],
            [],
            canvas_size,
        )

    # Rotation Z(zan2d) -> X(yan2d) -> Y(xan2d) - a Jagex field-naming quirk the
    # reference confirms: xan2d drives the Y stage, yan2d the X stage.
    sin_z, cos_z = math.sin(zan2d * _ANGLE_UNIT), math.cos(zan2d * _ANGLE_UNIT)
    sin_x, cos_x = math.sin(yan2d * _ANGLE_UNIT), math.cos(yan2d * _ANGLE_UNIT)
    sin_y, cos_y = math.sin(xan2d * _ANGLE_UNIT), math.cos(xan2d * _ANGLE_UNIT)

    rotated_x = [0.0] * model.vertex_count
    rotated_y = [0.0] * model.vertex_count
    rotated_z = [0.0] * model.vertex_count
    for i in range(model.vertex_count):
        x, y, z = float(vertex_x[i]), float(vertex_y[i]), float(vertex_z[i])
        t = y * sin_z + x * cos_z
        y = y * cos_z - x * sin_z
        x = t
        t = z * sin_x + x * cos_x
        z = z * cos_x - x * sin_x
        x = t
        t = y * cos_y - z * sin_y
        z = y * sin_y + z * cos_y
        y = t
        rotated_x[i], rotated_y[i], rotated_z[i] = x, y, z

    min_x = min(rotated_x[v] for v in used_vertices)
    max_x = max(rotated_x[v] for v in used_vertices)
    min_y = min(rotated_y[v] for v in used_vertices)
    max_y = max(rotated_y[v] for v in used_vertices)
    min_z = min(rotated_z[v] for v in used_vertices)
    max_z = max(rotated_z[v] for v in used_vertices)
    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    center_z = (min_z + max_z) / 2.0
    max_half = max(
        max_x - center_x, center_x - min_x, max_y - center_y, center_y - min_y, 1.0
    )
    camera_depth = max(max_half * _CLIP_SCALE / _TARGET_NDC, _MIN_CAMERA_DEPTH)
    offset_x, offset_y, offset_z = -center_x, -center_y, camera_depth - center_z

    screen_x: list[float] = []
    screen_y: list[float] = []
    # Camera-space position per vertex (horizontal, vertical, depth), kept so a
    # textured face can build its texture basis (see _compute_face_uv).
    local_x: list[float] = []
    local_y: list[float] = []
    local_z: list[float] = []
    for i in range(model.vertex_count):
        fx = rotated_x[i] + offset_x
        fy = rotated_y[i] + offset_y
        fz = rotated_z[i] + offset_z
        if fz < _MIN_DEPTH:
            fz = _MIN_DEPTH
        screen_x.append(fx * focal / fz + center)
        screen_y.append(fy * focal / fz + center)
        local_x.append(fx)
        local_y.append(fy)
        local_z.append(fz)

    # Back-face culling like the classic OSRS client: a face whose projected
    # winding points away from the camera is dropped. clansocket's GPU renderer
    # instead disables culling and relies on dual-side lighting, but that reveals
    # a model's shadowed *inner* faces where they extend past the outer surface
    # (an infernal cape's dark lining poking past the lava, etc.); the game culls
    # them, so we do too. The z-buffer still resolves depth among the survivors.
    face_order = [
        f
        for f in range(model.face_count)
        if _is_front_face(
            screen_x, screen_y, model.face_a[f], model.face_b[f], model.face_c[f]
        )
    ]
    face_priorities = [model.face_priority(f) for f in range(model.face_count)]

    face_uv = _compute_face_uv(
        model, face_order, is_textured, local_x, local_y, local_z
    )

    return PreparedGeometry(
        model.face_a,
        model.face_b,
        model.face_c,
        model.face_colors,
        model.face_render_types,
        model.face_transparencies,
        is_textured,
        model.face_textures,
        face_uv,
        face_priorities,
        vertex_x,
        vertex_y,
        vertex_z,
        normal_x,
        normal_y,
        normal_z,
        normal_n,
        screen_x,
        screen_y,
        local_z,
        face_order,
        canvas_size,
    )


def _compute_face_uv(
    model: ModelDefinition,
    visible_faces: list[int],
    is_textured: list[bool],
    local_x: list[float],
    local_y: list[float],
    local_z: list[float],
) -> dict[int, tuple[float, float, float, float, float, float]]:
    """Texture (u, v) at each vertex of every visible textured face, in texels.

    Each textured face carries a texture triangle P, M, N (camera-space); the
    texture image spans that parallelogram with P->M the u axis and P->N the v
    axis, both over the full texture width. A face vertex's (u, v) is its
    position resolved into that (M-P, N-P) basis (a 2x2 least-squares solve on
    the plane), scaled to texels. Wrapping past the edges is handled in the
    rasterizer, so values outside [0, res) are fine.
    """
    face_uv: dict[int, tuple[float, float, float, float, float, float]] = {}
    for f in visible_faces:
        if not is_textured[f]:
            continue
        p, m, n = model.texture_vertices(f)
        e1 = (local_x[m] - local_x[p], local_y[m] - local_y[p], local_z[m] - local_z[p])
        e2 = (local_x[n] - local_x[p], local_y[n] - local_y[p], local_z[n] - local_z[p])
        a11 = e1[0] * e1[0] + e1[1] * e1[1] + e1[2] * e1[2]
        a12 = e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2]
        a22 = e2[0] * e2[0] + e2[1] * e2[1] + e2[2] * e2[2]
        det = a11 * a22 - a12 * a12
        if det == 0.0:
            continue
        coords: list[float] = []
        for v in (model.face_a[f], model.face_b[f], model.face_c[f]):
            w = (
                local_x[v] - local_x[p],
                local_y[v] - local_y[p],
                local_z[v] - local_z[p],
            )
            b1 = w[0] * e1[0] + w[1] * e1[1] + w[2] * e1[2]
            b2 = w[0] * e2[0] + w[1] * e2[1] + w[2] * e2[2]
            s = (b1 * a22 - b2 * a12) / det
            t = (b2 * a11 - b1 * a12) / det
            coords.append(s * _TEXTURE_RES)
            coords.append(t * _TEXTURE_RES)
        face_uv[f] = (
            coords[0],
            coords[1],
            coords[2],
            coords[3],
            coords[4],
            coords[5],
        )
    return face_uv


def render_from_geometry(
    geometry: PreparedGeometry,
    *,
    ambient: int,
    contrast: int,
    color_find: list[int] | None,
    color_replace: list[int] | None,
    textures: dict[int, np.ndarray] | None = None,
) -> bytes:
    """The per-item phase: recolor + lighting + rasterize. Everything here is
    cheap except the triangle fill itself - geometry (the expensive part) is
    entirely reused from `geometry`.

    `textures` maps a texture id to its RGB image (see texture_image.py). When a
    textured face's texture is present it is UV-mapped; otherwise that face is
    left transparent, the same gap the renderer produced before texturing.

    Returns raw `bytes` straight from `ndarray.tobytes()` - do not wrap in
    `bytearray()`. That would be a pure-waste copy (bytes -> bytearray) that a
    caller then has to copy right back to pass to `Image.frombytes()`, which
    accepts `bytes`/any buffer-protocol object directly.
    """
    size = geometry.canvas_size
    canvas = np.zeros((size, size, 4), dtype=np.uint8)
    if not geometry.face_order:
        return canvas.tobytes()

    # Nearer (smaller adjusted view depth) wins; start every pixel infinitely far.
    zbuffer = np.full((size, size), np.inf, dtype=np.float64)

    face_colors = apply_recolor(geometry.face_colors, color_find, color_replace)
    lit_a, lit_b, lit_c, back_a, back_b, back_c = compute_face_lit_colors(
        geometry.face_a,
        geometry.face_b,
        geometry.face_c,
        face_colors,
        geometry.face_render_types,
        geometry.vertex_x,
        geometry.vertex_y,
        geometry.vertex_z,
        geometry.normal_x,
        geometry.normal_y,
        geometry.normal_z,
        geometry.normal_n,
        AMBIENT_BASE + ambient,
        CONTRAST_BASE + contrast,
    )

    tex_light = _texture_lightness(geometry, ambient, contrast) if textures else None
    lit = (lit_a, lit_b, lit_c, back_a, back_b, back_c)

    # Two passes like clansocket: opaque faces first (write depth), then the
    # semi-transparent ones back-to-front, depth-tested but not depth-writing,
    # blended over what is already there. Fully invisible faces are dropped.
    opaque: list[int] = []
    transparent: list[int] = []
    render_types = geometry.face_render_types
    for f in geometry.face_order:
        a, b, c = geometry.face_a[f], geometry.face_b[f], geometry.face_c[f]
        if a == b == c:
            continue
        # RuneLite ItemSpriteFactory leaves an untextured render-type-2 face
        # undrawn (its faceColors3 becomes -2). Skipping it drops the fishing
        # net's white triangles and a cape's stray dark face.
        if (
            not geometry.is_textured[f]
            and render_types is not None
            and render_types[f] == 2
        ):
            continue
        alpha = _face_alpha(geometry, f)
        if alpha < _MIN_ALPHA:
            continue
        (opaque if alpha >= _OPAQUE_ALPHA else transparent).append(f)

    for f in opaque:
        _draw_face(
            canvas, zbuffer, size, geometry, f, lit, tex_light, textures, 255.0, True
        )

    transparent.sort(key=lambda f: -_face_mean_depth(geometry, f))
    for f in transparent:
        _draw_face(
            canvas,
            zbuffer,
            size,
            geometry,
            f,
            lit,
            tex_light,
            textures,
            float(_face_alpha(geometry, f)),
            False,
        )

    return _auto_center(canvas, size).tobytes()


def _auto_center(canvas: np.ndarray, size: int) -> np.ndarray:
    """Shifts the rendered content so its own alpha bounding box is centred in
    the canvas (clansocket's ``autoCenter``). The bounding-box camera-fit only
    roughly centres the model; perspective and per-face priority nudges leave the
    silhouette slightly off-centre, so this recentres the final pixels."""
    ys, xs = np.nonzero(canvas[:, :, 3] >= _ALPHA_THRESHOLD)
    if xs.size == 0:
        return canvas
    min_x, max_x = int(xs.min()), int(xs.max())
    min_y, max_y = int(ys.min()), int(ys.max())
    shift_x = (size - 1 - (min_x + max_x)) // 2
    shift_y = (size - 1 - (min_y + max_y)) // 2
    if shift_x == 0 and shift_y == 0:
        return canvas
    src_min_x, src_max_x = max(0, -shift_x), min(size, size - shift_x)
    src_min_y, src_max_y = max(0, -shift_y), min(size, size - shift_y)
    shifted = np.zeros_like(canvas)
    shifted[
        src_min_y + shift_y : src_max_y + shift_y,
        src_min_x + shift_x : src_max_x + shift_x,
    ] = canvas[src_min_y:src_max_y, src_min_x:src_max_x]
    return shifted


def _draw_face(
    canvas: np.ndarray,
    zbuffer: np.ndarray,
    size: int,
    geometry: PreparedGeometry,
    f: int,
    lit: tuple[
        list[tuple[int, int, int]],
        list[tuple[int, int, int]],
        list[tuple[int, int, int]],
        list[tuple[int, int, int]],
        list[tuple[int, int, int]],
        list[tuple[int, int, int]],
    ],
    tex_light: tuple[list[int], list[int], list[int], list[int], list[int], list[int]]
    | None,
    textures: dict[int, np.ndarray] | None,
    alpha: float,
    write_depth: bool,
) -> None:
    a, b, c = geometry.face_a[f], geometry.face_b[f], geometry.face_c[f]
    # Dual-side lighting: pick front or back lit colours from the face's
    # projected winding, the way clansocket's shader uses gl_FrontFacing.
    front = _is_front_face(geometry.screen_x, geometry.screen_y, a, b, c)
    za, zb, zc = _face_depths(geometry, f, a, b, c)
    if geometry.is_textured[f]:
        if tex_light is not None:
            _fill_textured_face(
                canvas,
                zbuffer,
                size,
                geometry,
                f,
                za,
                zb,
                zc,
                tex_light,
                front,
                textures,
                alpha,
                write_depth,
            )
        return
    lit_a, lit_b, lit_c, back_a, back_b, back_c = lit
    if front:
        ca, cb, cc = lit_a[f], lit_b[f], lit_c[f]
    else:
        ca, cb, cc = back_a[f], back_b[f], back_c[f]
    fill_triangle(
        canvas,
        zbuffer,
        size,
        geometry.screen_x[a],
        geometry.screen_y[a],
        za,
        float(ca[0]),
        float(ca[1]),
        float(ca[2]),
        geometry.screen_x[b],
        geometry.screen_y[b],
        zb,
        float(cb[0]),
        float(cb[1]),
        float(cb[2]),
        geometry.screen_x[c],
        geometry.screen_y[c],
        zc,
        float(cc[0]),
        float(cc[1]),
        float(cc[2]),
        alpha,
        write_depth,
    )


def _face_alpha(geometry: PreparedGeometry, f: int) -> int:
    """Opacity 0..255 of a face - ``255 - faceAlpha`` (clansocket), so the
    classic sentinels -1/-2 map to 0/1 (invisible) and 0 to fully opaque."""
    transparencies = geometry.face_transparencies
    if transparencies is None:
        return 255
    return 255 - (transparencies[f] & 0xFF)


def _face_mean_depth(geometry: PreparedGeometry, f: int) -> float:
    return (
        geometry.local_z[geometry.face_a[f]]
        + geometry.local_z[geometry.face_b[f]]
        + geometry.local_z[geometry.face_c[f]]
    ) / 3.0


def _face_depths(
    geometry: PreparedGeometry, f: int, a: int, b: int, c: int
) -> tuple[float, float, float]:
    """Per-vertex z-buffer depth for a face: its view-space depth pulled nearer
    by the face's priority (``offsetZ - facePriority * 13`` in the reference),
    so higher-priority faces win the depth test where geometry overlaps."""
    offset = geometry.face_priorities[f] * _PRIORITY_Z_STEP
    return (
        geometry.local_z[a] - offset,
        geometry.local_z[b] - offset,
        geometry.local_z[c] - offset,
    )


def _is_front_face(
    screen_x: Sequence[float], screen_y: Sequence[float], a: int, b: int, c: int
) -> bool:
    """Whether the face shows its front side to the camera, from the sign of its
    projected 2D signed area (this file's top-down screen convention: a front
    face is positively wound). Selects front vs back lit colours, matching
    clansocket's `gl_FrontFacing`."""
    return (
        (screen_x[a] - screen_x[b]) * (screen_y[c] - screen_y[b])
        - (screen_x[c] - screen_x[b]) * (screen_y[a] - screen_y[b])
    ) > 0


def _texture_lightness(
    geometry: PreparedGeometry, ambient: int, contrast: int
) -> tuple[list[int], list[int], list[int], list[int], list[int], list[int]]:
    return compute_face_texture_lightness(
        geometry.face_a,
        geometry.face_b,
        geometry.face_c,
        geometry.face_render_types,
        geometry.is_textured,
        geometry.vertex_x,
        geometry.vertex_y,
        geometry.vertex_z,
        geometry.normal_x,
        geometry.normal_y,
        geometry.normal_z,
        geometry.normal_n,
        AMBIENT_BASE + ambient,
        CONTRAST_BASE + contrast,
    )


def _fill_textured_face(
    canvas: np.ndarray,
    zbuffer: np.ndarray,
    size: int,
    geometry: PreparedGeometry,
    f: int,
    za: float,
    zb: float,
    zc: float,
    tex_light: tuple[list[int], list[int], list[int], list[int], list[int], list[int]],
    front: bool,
    textures: dict[int, np.ndarray] | None,
    alpha: float,
    write_depth: bool,
) -> None:
    if textures is None or geometry.face_textures is None:
        return
    uv = geometry.face_uv.get(f)
    if uv is None:
        return
    texture = textures.get(geometry.face_textures[f])
    if texture is None:
        return

    a, b, c = geometry.face_a[f], geometry.face_b[f], geometry.face_c[f]
    iza = 1.0 / geometry.local_z[a]
    izb = 1.0 / geometry.local_z[b]
    izc = 1.0 / geometry.local_z[c]
    la, lb, lc = tex_light[:3] if front else tex_light[3:]
    fill_triangle_textured(
        canvas,
        zbuffer,
        size,
        geometry.screen_x[a],
        geometry.screen_y[a],
        za,
        iza,
        uv[0] * iza,
        uv[1] * iza,
        float(la[f]),
        geometry.screen_x[b],
        geometry.screen_y[b],
        zb,
        izb,
        uv[2] * izb,
        uv[3] * izb,
        float(lb[f]),
        geometry.screen_x[c],
        geometry.screen_y[c],
        zc,
        izc,
        uv[4] * izc,
        uv[5] * izc,
        float(lc[f]),
        texture,
        _TEXTURE_RES,
        alpha,
        write_depth,
    )


def render_icon(
    model: ModelDefinition,
    *,
    xan2d: int,
    yan2d: int,
    zan2d: int,
    zoom2d: int,
    x_offset2d: int,
    y_offset2d: int,
    resize_x: int | None,
    resize_y: int | None,
    resize_z: int | None,
    ambient: int,
    contrast: int,
    color_find: list[int] | None,
    color_replace: list[int] | None,
    canvas_size: int = 512,
    textures: dict[int, np.ndarray] | None = None,
) -> bytes:
    """Convenience wrapper for one-off renders (tests, manual scripts). The
    ingest pipeline calls prepare_geometry/render_from_geometry directly so it
    can cache the geometry phase across items - see icon_worker.py."""
    geometry = prepare_geometry(
        model,
        xan2d=xan2d,
        yan2d=yan2d,
        zan2d=zan2d,
        zoom2d=zoom2d,
        x_offset2d=x_offset2d,
        y_offset2d=y_offset2d,
        resize_x=resize_x,
        resize_y=resize_y,
        resize_z=resize_z,
        canvas_size=canvas_size,
    )
    return render_from_geometry(
        geometry,
        ambient=ambient,
        contrast=contrast,
        color_find=color_find,
        color_replace=color_replace,
        textures=textures,
    )
