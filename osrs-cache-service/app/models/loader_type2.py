"""Decodes the "type2" OSRS model binary format - trailing marker bytes
(-2, -1). Still present in the live cache alongside type3 (older items that
haven't been re-exported in the newer format). Ported field-for-field from
RuneLite's ``ModelLoader.decodeType2`` - see loader_type3.py for why variable
names mirror the Java source instead of being renamed.
"""

from __future__ import annotations

from app.definitions.base import DefinitionReader
from app.models.definition import ModelDefinition


def decode_type2(model_id: int, data: bytes) -> ModelDefinition:
    r1, r2, r3, r4, r5 = (DefinitionReader(data) for _ in range(5))

    r1.seek(len(data) - 23)
    var9 = r1.u2()
    var10 = r1.u2()
    var11 = r1.u1()
    var12 = r1.u1()
    var13 = r1.u1()
    var14 = r1.u1()
    var15 = r1.u1()
    var16 = r1.u1()  # noqa: F841 - packedVertexGroups flag, unused (animation skeleton binding)
    var17 = r1.u1()  # noqa: F841 - animaya flag, unused (not needed for a static icon)
    var18 = r1.u2()
    var19 = r1.u2()
    var20 = r1.u2()
    var21 = r1.u2()
    var22 = r1.u2()

    var24 = var9
    var25 = var24
    var24 += var10
    var26 = var24
    if var13 == 255:
        var24 += var10
    var27 = var24
    if var15 == 1:
        var24 += var10
    var28 = var24
    if var12 == 1:
        var24 += var10
    var29 = var24
    var24 += var22
    var30 = var24
    if var14 == 1:
        var24 += var10
    var31 = var24
    var24 += var21
    var32 = var24
    var24 += var10 * 2
    var33 = var24
    var24 += var11 * 6
    var34 = var24
    var24 += var18
    var35 = var24
    var24 += var19
    var36 = var24
    var24 += var20

    vertex_x = [0] * var9
    vertex_y = [0] * var9
    vertex_z = [0] * var9
    face_a = [0] * var10
    face_b = [0] * var10
    face_c = [0] * var10
    face_colors = [0] * var10
    tex_a = [0] * var11
    tex_b = [0] * var11
    tex_c = [0] * var11
    face_render_types = [0] * var10 if var12 == 1 else None
    face_textures = [-1] * var10 if var12 == 1 else None
    face_texture_coords = [-1] * var10 if var12 == 1 else None
    face_render_priorities = [0] * var10 if var13 == 255 else None
    priority = var13 if var13 != 255 else 0
    face_transparencies = [0] * var10 if var14 == 1 else None

    r1.seek(0)
    r2.seek(var34)
    r3.seek(var35)
    r4.seek(var36)
    r5.seek(var29)
    dx = dy = dz = 0
    for i in range(var9):
        flags = r1.u1()
        ddx = r2.short_smart_signed() if flags & 1 else 0
        ddy = r3.short_smart_signed() if flags & 2 else 0
        ddz = r4.short_smart_signed() if flags & 4 else 0
        dx += ddx
        dy += ddy
        dz += ddz
        vertex_x[i], vertex_y[i], vertex_z[i] = dx, dy, dz

    r1.seek(var32)
    r2.seek(var28)
    r3.seek(var26)
    r4.seek(var30)
    r5.seek(var27)
    for i in range(var10):
        face_colors[i] = r1.u2()
        if var12 == 1:
            flag = r2.u1()
            face_render_types[i] = 1 if (flag & 1) == 1 else 0  # type: ignore[index]
            if (flag & 2) == 2:
                face_textures[i] = face_colors[i]  # type: ignore[index]
                face_colors[i] = 127
                face_texture_coords[i] = flag >> 2  # type: ignore[index]
        if var13 == 255:
            face_render_priorities[i] = r3.s1()  # type: ignore[index]
        if var14 == 1:
            face_transparencies[i] = r4.s1()  # type: ignore[index]

    r1.seek(var31)
    r2.seek(var25)
    a = b = c = last = 0
    for i in range(var10):
        opcode = r2.u1()
        if opcode == 1:
            a = r1.short_smart_signed() + last
            b = r1.short_smart_signed() + a
            c = r1.short_smart_signed() + b
            last = c
        elif opcode == 2:
            b = c
            c = r1.short_smart_signed() + last
            last = c
        elif opcode == 3:
            a = c
            c = r1.short_smart_signed() + last
            last = c
        elif opcode == 4:
            a, b = b, a
            c = r1.short_smart_signed() + last
            last = c
        face_a[i], face_b[i], face_c[i] = a, b, c

    r1.seek(var33)
    for i in range(var11):
        tex_a[i] = r1.u2()
        tex_b[i] = r1.u2()
        tex_c[i] = r1.u2()

    return ModelDefinition(
        id=model_id,
        vertex_x=vertex_x,
        vertex_y=vertex_y,
        vertex_z=vertex_z,
        face_a=face_a,
        face_b=face_b,
        face_c=face_c,
        face_colors=face_colors,
        priority=priority,
        face_render_priorities=face_render_priorities,
        face_transparencies=face_transparencies,
        face_render_types=face_render_types,
        face_textures=face_textures,
        face_texture_coords=face_texture_coords,
        tex_a=tex_a,
        tex_b=tex_b,
        tex_c=tex_c,
    )
