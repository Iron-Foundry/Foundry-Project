"""Decodes the "type3" (current) OSRS model binary format - trailing marker
bytes (-3, -1). Ported field-for-field from RuneLite's
``ModelLoader.decodeType3`` - variable names intentionally mirror the Java
source (var9, var10, ...) rather than being renamed, since this is a dense
offset-table format where a transcription slip is easy to introduce and hard
to spot; matching the reference 1:1 makes it possible to diff against it.
"""

from __future__ import annotations

from app.definitions.base import DefinitionReader
from app.models.definition import ModelDefinition


def decode_type3(model_id: int, data: bytes) -> ModelDefinition:
    r1, r2, r3, r4, r5, r6, r7 = (DefinitionReader(data) for _ in range(7))

    r1.seek(len(data) - 26)
    var9 = r1.u2()
    var10 = r1.u2()
    var11 = r1.u1()
    var12 = r1.u1()
    var13 = r1.u1()
    var14 = r1.u1()
    var15 = r1.u1()
    var16 = r1.u1()
    var17 = r1.u1()  # noqa: F841 - packedVertexGroups flag, unused (animation skeleton binding)
    var18 = r1.u1()  # noqa: F841 - animaya flag, unused (not needed for a static icon)
    var19 = r1.u2()
    var20 = r1.u2()
    var21 = r1.u2()
    var22 = r1.u2()
    var23 = r1.u2()
    var24 = r1.u2()

    var25 = var26 = var27 = 0
    texture_render_types = bytearray(var11)
    if var11 > 0:
        r1.seek(0)
        for i in range(var11):
            b = r1.s1()
            texture_render_types[i] = b & 0xFF
            if b == 0:
                var25 += 1
            if 1 <= b <= 3:
                var26 += 1
            if b == 2:
                var27 += 1

    var28 = var11 + var9
    var58 = var28
    if var12 == 1:
        var28 += var10
    var30 = var28
    var28 += var10
    var31 = var28
    if var13 == 255:
        var28 += var10
    var32 = var28
    if var15 == 1:
        var28 += var10
    var33 = var28
    var28 += var24
    var34 = var28
    if var14 == 1:
        var28 += var10
    var35 = var28
    var28 += var22
    var36 = var28
    if var16 == 1:
        var28 += var10 * 2
    var37 = var28
    var28 += var23
    var38 = var28
    var28 += var10 * 2
    var39 = var28
    var28 += var19
    var40 = var28
    var28 += var20
    var41 = var28
    var28 += var21
    var42 = var28
    # var28's further progression (through var43-var47, advanced texture-face
    # data for render types 1-3) is only used afterward to locate a trailing
    # per-face Z-offset block we don't need - RuneLite's own loader doesn't
    # even read those texture-face types, so we stop tracking var28 here.

    vertex_x = [0] * var9
    vertex_y = [0] * var9
    vertex_z = [0] * var9
    face_a = [0] * var10
    face_b = [0] * var10
    face_c = [0] * var10
    face_colors = [0] * var10
    face_render_types = [0] * var10 if var12 == 1 else None
    face_render_priorities = [0] * var10 if var13 == 255 else None
    priority = var13 if var13 != 255 else 0
    face_transparencies = [0] * var10 if var14 == 1 else None
    face_textures = [-1] * var10 if var16 == 1 else None
    face_texture_coords = [-1] * var10 if (var16 == 1 and var11 > 0) else None

    r1.seek(var11)
    r2.seek(var39)
    r3.seek(var40)
    r4.seek(var41)
    r5.seek(var33)
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

    r1.seek(var38)
    r2.seek(var58)
    r3.seek(var31)
    r4.seek(var34)
    r5.seek(var32)
    r6.seek(var36)
    r7.seek(var37)
    for i in range(var10):
        face_colors[i] = r1.u2()
        if var12 == 1:
            face_render_types[i] = r2.s1()  # type: ignore[index]
        if var13 == 255:
            face_render_priorities[i] = r3.s1()  # type: ignore[index]
        if var14 == 1:
            face_transparencies[i] = r4.s1()  # type: ignore[index]
        if var16 == 1:
            texture_id = r6.u2() - 1
            face_textures[i] = texture_id  # type: ignore[index]
            if face_texture_coords is not None and texture_id != -1:
                face_texture_coords[i] = r7.u1() - 1

    r1.seek(var35)
    r2.seek(var30)
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

    tex_a = [0] * var11
    tex_b = [0] * var11
    tex_c = [0] * var11
    r1.seek(var42)
    for i in range(var11):
        if texture_render_types[i] == 0:
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
