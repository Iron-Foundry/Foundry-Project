from __future__ import annotations

import numpy as np

from app.models.definition import ModelDefinition
from app.models.rasterizer import (
    prepare_geometry,
    render_from_geometry,
)
from app.models.texture_image import TEXTURE_RES

_FLAT_ROTATION = {"xan2d": 0, "yan2d": 0, "zan2d": 0}
_CAMERA = {"zoom2d": 1000, "x_offset2d": 0, "y_offset2d": 0}
_NO_RESIZE = {"resize_x": None, "resize_y": None, "resize_z": None}


def _tetrahedron() -> ModelDefinition:
    return ModelDefinition(
        id=2,
        vertex_x=[0, 60, -60, 0],
        vertex_y=[60, -40, -40, -40],
        vertex_z=[0, 40, 40, -60],
        face_a=[0, 0, 0, 1],
        face_b=[1, 2, 3, 3],
        face_c=[2, 3, 1, 2],
        face_colors=[100, 100, 100, 100],
    )


def _camera_quad(color: int, depth: int) -> ModelDefinition:
    """One camera-facing quad at game-z ``depth`` with the given hsl face colour."""
    return ModelDefinition(
        id=4,
        vertex_x=[-50, 50, 50, -50],
        vertex_y=[50, 50, -50, -50],
        vertex_z=[depth, depth, depth, depth],
        face_a=[0, 0],
        face_b=[1, 2],
        face_c=[2, 3],
        face_colors=[color, color],
    )


def _render_center(model: ModelDefinition) -> np.ndarray:
    geometry = prepare_geometry(model, **_FLAT_ROTATION, **_CAMERA, **_NO_RESIZE)
    raw = render_from_geometry(
        geometry, ambient=0, contrast=0, color_find=None, color_replace=None
    )
    canvas = np.frombuffer(raw, dtype=np.uint8).reshape(
        geometry.canvas_size, geometry.canvas_size, 4
    )
    return canvas[geometry.canvas_size // 2, geometry.canvas_size // 2]


def test_back_faces_are_culled() -> None:
    model = _tetrahedron()
    geometry = prepare_geometry(model, **_FLAT_ROTATION, **_CAMERA, **_NO_RESIZE)

    # A closed solid shows only its front faces; the rest are culled.
    assert 0 < len(geometry.face_order) < model.face_count


def test_z_buffer_draws_nearer_face_over_farther_regardless_of_order() -> None:
    front = _render_center(_camera_quad(color=6000, depth=0))
    back = _render_center(_camera_quad(color=20000, depth=200))
    assert not np.array_equal(front[:3], back[:3])  # colours must be distinguishable

    # Combined quad set with the FAR quad listed first, so a naive last-writer
    # fill would show the back colour; the z-buffer must still pick the front.
    combined = ModelDefinition(
        id=5,
        vertex_x=[-50, 50, 50, -50, -50, 50, 50, -50],
        vertex_y=[50, 50, -50, -50, 50, 50, -50, -50],
        vertex_z=[200, 200, 200, 200, 0, 0, 0, 0],
        face_a=[0, 0, 4, 4],
        face_b=[1, 2, 5, 6],
        face_c=[2, 3, 6, 7],
        face_colors=[20000, 20000, 6000, 6000],
    )
    center = _render_center(combined)
    assert center[3] == 255
    assert np.array_equal(center[:3], front[:3])


def _textured_quad() -> ModelDefinition:
    """A flat camera-facing quad, both triangles textured with texture id 5 and
    no explicit texture-triangle (so each face's own vertices are P, M, N)."""
    return ModelDefinition(
        id=3,
        vertex_x=[-50, 50, 50, -50],
        vertex_y=[50, 50, -50, -50],
        vertex_z=[0, 0, 0, 0],
        face_a=[0, 0],
        face_b=[1, 2],
        face_c=[2, 3],
        face_colors=[127, 127],
        face_render_types=[0, 0],
        face_textures=[5, 5],
    )


def test_texture_uv_maps_face_vertices_to_texel_corners() -> None:
    geometry = prepare_geometry(
        _textured_quad(), **_FLAT_ROTATION, **_CAMERA, **_NO_RESIZE
    )

    # Both coplanar triangles face the camera; each face's P/M/N are its own
    # vertices, so P->(0,0), M->(res,0), N->(0,res) exactly.
    assert len(geometry.face_uv) == 2
    expected = (0.0, 0.0, float(TEXTURE_RES), 0.0, 0.0, float(TEXTURE_RES))
    for uv in geometry.face_uv.values():
        for got, want in zip(uv, expected):
            assert abs(got - want) < 1e-6


def test_textured_face_samples_texture_and_keeps_light_ratio() -> None:
    geometry = prepare_geometry(
        _textured_quad(), **_FLAT_ROTATION, **_CAMERA, **_NO_RESIZE
    )
    texture = np.empty((TEXTURE_RES, TEXTURE_RES, 4), dtype=np.uint8)
    texture[..., 0] = 200
    texture[..., 1] = 100
    texture[..., 2] = 50
    texture[..., 3] = 255

    raw = render_from_geometry(
        geometry,
        ambient=0,
        contrast=0,
        color_find=None,
        color_replace=None,
        textures={5: texture},
    )
    canvas = np.frombuffer(raw, dtype=np.uint8).reshape(
        geometry.canvas_size, geometry.canvas_size, 4
    )
    opaque = canvas[canvas[..., 3] == 255]
    assert opaque.shape[0] > 0
    # Light modulation is a scalar multiply, so the texel's R>G>B ordering holds.
    assert np.all(opaque[:, 0] >= opaque[:, 1])
    assert np.all(opaque[:, 1] >= opaque[:, 2])
    assert opaque[:, 0].max() > 0


def test_transparency_sentinel_faces_are_not_drawn() -> None:
    model = _textured_quad()
    model.face_transparencies = [-1, -1]  # -1 = fully invisible (alpha 0)
    geometry = prepare_geometry(model, **_FLAT_ROTATION, **_CAMERA, **_NO_RESIZE)
    texture = np.full((TEXTURE_RES, TEXTURE_RES, 4), 200, dtype=np.uint8)
    texture[..., 3] = 255

    raw = render_from_geometry(
        geometry,
        ambient=0,
        contrast=0,
        color_find=None,
        color_replace=None,
        textures={5: texture},
    )
    canvas = np.frombuffer(raw, dtype=np.uint8).reshape(
        geometry.canvas_size, geometry.canvas_size, 4
    )
    assert not np.any(canvas[..., 3] == 255)
