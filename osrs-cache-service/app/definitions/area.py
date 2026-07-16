"""Decodes an OSRS area definition - config archive, group 35.

Ported from RuneLite's ``AreaLoader.java``. An area ties a map icon (a sprite) and a
label (a name) to a place. Icons are positioned by the object locations that reference
the area (object opcode 82 = ``map_area_id``); labels are positioned by the polygon in
opcode 15.

Only a few opcodes carry data we keep, but every opcode must consume its exact width or
the stream desyncs - so the full table is ported even where the value is discarded.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.definitions.base import DefinitionReader

_NO_SPRITE = 32767


class AreaDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class AreaDefinition:
    id: int
    sprite_id: int = -1
    name: str | None = None
    text_color: int | None = None
    category: int | None = None
    polygon: list[tuple[int, int]] = field(default_factory=list)


def _big_smart2(r: DefinitionReader) -> int:
    value = r.big_smart2()
    return -1 if value == _NO_SPRITE else value


def decode_area(area_id: int, data: bytes) -> AreaDefinition:
    r = DefinitionReader(data)
    d = AreaDefinition(id=area_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        _decode_opcode(opcode, d, r)

    return d


def _decode_opcode(opcode: int, d: AreaDefinition, r: DefinitionReader) -> None:
    if opcode == 1:
        d.sprite_id = _big_smart2(r)
    elif opcode == 2:
        _big_smart2(r)
    elif opcode == 3:
        d.name = r.jstring()
    elif opcode == 4:
        d.text_color = r.u3()
    elif opcode == 5:
        r.u3()
    elif opcode in (6, 7, 8):
        r.u1()
    elif 10 <= opcode <= 14:
        r.jstring()
    elif opcode == 15:
        _decode_polygon(d, r)
    elif opcode == 16:
        pass
    elif opcode == 17:
        r.jstring()
    elif opcode == 18:
        _big_smart2(r)
    elif opcode == 19:
        d.category = r.u2()
    elif opcode in (21, 22):
        r.u4()
    elif opcode == 23:
        r.skip(3)
    elif opcode == 24:
        r.skip(4)
    elif opcode == 25:
        _big_smart2(r)
    elif opcode == 28:
        r.u1()
    elif opcode in (29, 30):
        r.skip(1)
    else:
        raise AreaDecodeError(f"unknown area opcode {opcode} at pos {r.pos - 1}")


def _decode_polygon(d: AreaDefinition, r: DefinitionReader) -> None:
    vertex_count = r.u1()
    for _ in range(vertex_count):
        x = r.s2()
        y = r.s2()
        d.polygon.append((x, y))
    r.u4()
    inner_count = r.u1()
    r.skip(inner_count * 4)
    r.skip(vertex_count)
