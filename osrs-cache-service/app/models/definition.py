"""In-memory representation of a decoded OSRS 3D model (archive 7).

Mirrors RuneLite's ``ModelDefinition`` - only the fields needed to render a
static 2D icon are kept (no animation frame data beyond animaya groups, which
we don't use either since icons are a single static pose).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(slots=True)
class ModelDefinition:
    id: int
    vertex_x: list[int]
    vertex_y: list[int]
    vertex_z: list[int]
    face_a: list[int]
    face_b: list[int]
    face_c: list[int]
    face_colors: list[int]
    priority: int = 0
    face_render_priorities: list[int] | None = None
    face_transparencies: list[int] | None = None
    face_render_types: list[int] | None = None
    face_textures: list[int] | None = None
    face_texture_coords: list[int] | None = None
    tex_a: list[int] | None = None
    tex_b: list[int] | None = None
    tex_c: list[int] | None = None

    @property
    def vertex_count(self) -> int:
        return len(self.vertex_x)

    @property
    def face_count(self) -> int:
        return len(self.face_a)

    def face_priority(self, face: int) -> int:
        if self.face_render_priorities is not None:
            return self.face_render_priorities[face]
        return self.priority

    def is_textured(self, face: int) -> bool:
        return self.face_textures is not None and self.face_textures[face] != -1

    def texture_vertices(self, face: int) -> tuple[int, int, int]:
        """The three model vertices (P, M, N) that define this textured face's
        texture plane. A per-face ``face_texture_coords`` entry indexes into the
        model's texture-triangle table (``tex_a/b/c``); when it is -1 (or absent)
        the face's own vertices are used, matching RuneLite's ``rasterFace``.
        """
        coords = self.face_texture_coords
        if (
            coords is not None
            and self.tex_a is not None
            and self.tex_b is not None
            and self.tex_c is not None
            and coords[face] != -1
        ):
            tri = coords[face]
            return self.tex_a[tri], self.tex_b[tri], self.tex_c[tri]
        return self.face_a[face], self.face_b[face], self.face_c[face]


def compute_face_normal(
    vertex_x: Sequence[float],
    vertex_y: Sequence[float],
    vertex_z: Sequence[float],
    a: int,
    b: int,
    c: int,
) -> tuple[float, float, float]:
    """Cross-product face normal, magnitude-reduced and rescaled to 256 - shared
    by per-vertex Gouraud accumulation and per-face flat shading."""
    x_a = vertex_x[b] - vertex_x[a]
    y_a = vertex_y[b] - vertex_y[a]
    z_a = vertex_z[b] - vertex_z[a]
    x_b = vertex_x[c] - vertex_x[a]
    y_b = vertex_y[c] - vertex_y[a]
    z_b = vertex_z[c] - vertex_z[a]

    nx = y_a * z_b - y_b * z_a
    ny = z_a * x_b - z_b * x_a
    nz = x_a * y_b - x_b * y_a

    while nx > 8192 or ny > 8192 or nz > 8192 or nx < -8192 or ny < -8192 or nz < -8192:
        nx /= 2
        ny /= 2
        nz /= 2

    length = (nx * nx + ny * ny + nz * nz) ** 0.5
    if length <= 0:
        length = 1
    return nx * 256 / length, ny * 256 / length, nz * 256 / length


def compute_vertex_normals(
    vertex_x: Sequence[float],
    vertex_y: Sequence[float],
    vertex_z: Sequence[float],
    face_a: list[int],
    face_b: list[int],
    face_c: list[int],
    face_render_types: list[int] | None,
) -> tuple[list[float], list[float], list[float], list[int]]:
    """Per-vertex summed face normals (RuneLite's ``computeNormals``).

    Takes plain vertex arrays rather than a ``ModelDefinition`` because
    normals must be computed from the *final* (post-resize) geometry - the
    reference client recomputes them after every ``resize()`` call rather
    than reusing normals from the raw decoded model. Not unit-normalized
    here - callers divide by the accumulated count during lighting, matching
    the original algorithm. Only faces with render_type 0 (smooth/Gouraud)
    contribute - flat-shaded faces (render_type 1) are lit separately via
    their own face normal.
    """
    n = len(vertex_x)
    normal_x = [0.0] * n
    normal_y = [0.0] * n
    normal_z = [0.0] * n
    normal_n = [0] * n

    for f in range(len(face_a)):
        a, b, c = face_a[f], face_b[f], face_c[f]
        render_type = face_render_types[f] if face_render_types is not None else 0
        if render_type != 0:
            continue

        nx, ny, nz = compute_face_normal(vertex_x, vertex_y, vertex_z, a, b, c)
        for v in (a, b, c):
            normal_x[v] += nx
            normal_y[v] += ny
            normal_z[v] += nz
            normal_n[v] += 1

    return normal_x, normal_y, normal_z, normal_n
