"""Decodes an OSRS object/scenery ("loc") definition (config archive, object group).

Opcode-loop format, ported field-for-field from RuneLite's actual
``ObjectLoader.java`` / ``EntityOpsLoader.java``. Every opcode is consumed with
the right width to keep the stream aligned even when its value isn't persisted.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader


class ObjectDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class ObjectDefinition:
    id: int
    name: str = ""
    size_x: int = 1
    size_y: int = 1
    animation_id: int | None = None
    category: int | None = None
    interactive: bool = True
    map_area_id: int | None = None
    wall_or_door: int = 0
    map_scene_id: int = -1
    offset_y: int = 0


def decode_object(object_id: int, data: bytes) -> ObjectDefinition:
    r = DefinitionReader(data)
    d = ObjectDefinition(id=object_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        _decode_opcode(opcode, d, r)

    return d


def _decode_opcode(opcode: int, d: ObjectDefinition, r: DefinitionReader) -> None:
    if opcode == 1:
        length = r.u1()
        r.skip(length * 3)  # model id (u2) + type (u1) per entry
    elif opcode == 2:
        d.name = r.jstring()
    elif opcode == 5:
        length = r.u1()
        r.skip(length * 2)  # model ids only
    elif opcode == 6:
        length = r.u1()
        r.skip(length * 5)  # model id (u4) + type (u1) per entry
    elif opcode == 7:
        length = r.u1()
        r.skip(length * 4)  # model ids only (u4)
    elif opcode == 14:
        d.size_x = r.u1()
    elif opcode == 15:
        d.size_y = r.u1()
    elif opcode in (17, 18, 21, 22, 23, 27, 62, 64, 73, 74, 89, 90, 94):
        pass  # boolean/enum flags, no payload
    elif opcode == 19:
        d.wall_or_door = r.u1()
    elif opcode == 24:
        d.animation_id = r.u2()
    elif opcode == 28:
        r.u1()  # decor displacement
    elif opcode == 29:
        r.s1()  # ambient
    elif opcode == 39:
        r.s1()  # contrast
    elif 30 <= opcode < 35:
        r.jstring()  # action op
    elif opcode in (40, 41):
        length = r.u1()
        r.skip(length * 4)  # recolour / retexture pairs
    elif opcode == 61:
        d.category = r.u2()
    elif 65 <= opcode <= 67:
        r.u2()  # model size x / height / y
    elif opcode == 68:
        d.map_scene_id = r.u2()
    elif opcode == 69:
        r.u1()  # blocking mask
    elif opcode in (70, 71):
        r.u2()  # offset x / height
    elif opcode == 72:
        d.offset_y = r.u2()
    elif opcode == 75:
        r.u1()  # supports items
    elif opcode in (77, 92):
        _skip_varbit_configs(r, extra_trailing_short=opcode == 92)
    elif opcode == 78:
        r.u2()  # ambient sound id
        r.u1()  # ambient sound distance
        r.u1()  # ambient sound retain
    elif opcode == 79:
        r.skip(6)  # change ticks min/max (u2, u2) + distance (u1) + retain (u1)
        length = r.u1()
        r.skip(length * 2)  # ambient sound ids
    elif opcode == 81:
        r.u1()  # contoured ground
    elif opcode == 82:
        d.map_area_id = r.u2()
    elif opcode == 91:
        r.u1()  # sound distance fade curve
    elif opcode == 93:
        r.u1()
        r.u2()
        r.u1()
        r.u2()  # sound fade in/out curve + duration
    elif opcode == 95:
        r.u1()  # sound visibility
    elif opcode == 96:
        r.u1()  # raise
    elif opcode == 100:
        r.u1()
        r.u1()
        r.jstring()  # sub op
    elif opcode in (101, 102):
        r.u1()
        if opcode == 102:
            r.u2()
        r.u2()
        r.u2()
        r.u4()
        r.u4()
        r.jstring()  # conditional (sub) op
    elif opcode == 249:
        _skip_params(r)
    else:
        raise ObjectDecodeError(f"unknown object opcode {opcode} at pos {r.pos - 1}")


def _skip_varbit_configs(r: DefinitionReader, extra_trailing_short: bool) -> None:
    r.u2()  # varbit id
    r.u2()  # varp id
    if extra_trailing_short:
        r.u2()
    count = r.u1()
    r.skip((count + 1) * 2)  # config change dest


def _skip_params(r: DefinitionReader) -> None:
    count = r.u1()
    for _ in range(count):
        kind = r.u1()
        r.u3()  # param key
        if kind == 1:
            r.jstring()
        elif kind == 2:
            r.skip(8)  # long
        else:
            r.u4()
