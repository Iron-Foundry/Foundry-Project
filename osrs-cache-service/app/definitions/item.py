"""Decodes an OSRS item definition (config archive, item group).

Opcode-loop format, ported field-for-field from RuneLite's actual
``ItemLoader.java`` / ``EntityOpsLoader.java`` (github.com/runelite/runelite) -
verified against real item definitions (e.g. id 995 "Coins") from a live cache.
Every opcode must be consumed with the right width to keep the stream aligned -
an unrecognised opcode raises so the group falls back to raw-only storage
instead of silently corrupting the fields that follow.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader


class ItemDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class ItemDefinition:
    id: int
    name: str = ""
    examine: str = ""
    stackable: bool = False
    value: int = 0
    members: bool = False
    tradeable: bool = True
    noted_id: int | None = None
    noted_template: int | None = None
    placeholder_id: int | None = None
    placeholder_template: int | None = None
    team_id: int | None = None
    weight: int | None = None
    inventory_model: int | None = None
    zoom2d: int | None = None
    xan2d: int | None = None
    yan2d: int | None = None
    x_offset2d: int | None = None
    y_offset2d: int | None = None
    zan2d: int | None = None
    resize_x: int | None = None
    resize_y: int | None = None
    resize_z: int | None = None
    ambient: int = 0
    contrast: int = 0
    color_find: list[int] | None = None
    color_replace: list[int] | None = None
    texture_find: list[int] | None = None
    texture_replace: list[int] | None = None


def decode_item(item_id: int, data: bytes) -> ItemDefinition:
    r = DefinitionReader(data)
    d = ItemDefinition(id=item_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        _decode_opcode(opcode, d, r)

    return d


def _decode_opcode(opcode: int, d: ItemDefinition, r: DefinitionReader) -> None:
    if opcode == 1:
        d.inventory_model = r.u2()
    elif opcode == 2:
        d.name = r.jstring()
    elif opcode == 3:
        d.examine = r.jstring()
    elif opcode == 4:
        d.zoom2d = r.u2()
    elif opcode == 5:
        d.xan2d = r.u2()
    elif opcode == 6:
        d.yan2d = r.u2()
    elif opcode == 7:
        d.x_offset2d = r.s2()
    elif opcode == 8:
        d.y_offset2d = r.s2()
    elif opcode == 9:
        r.jstring()  # unused legacy field
    elif opcode == 11:
        d.stackable = True
    elif opcode == 12:
        d.value = r.u4()
    elif opcode in (13, 14, 27):
        r.s1()  # wearPos1 / wearPos2 / wearPos3
    elif opcode == 15:
        d.tradeable = False
    elif opcode == 16:
        d.members = True
    elif opcode in (23, 25):
        r.u2()  # gendered model
        r.u1()  # gendered offset
    elif opcode in (45, 48):
        r.u4()  # gendered model (extended)
        r.u1()  # gendered offset
    elif opcode in (24, 26):
        r.u2()  # gendered model
    elif 30 <= opcode < 35 or 35 <= opcode < 40:
        r.jstring()  # ground/interface action
    elif opcode == 40:
        count = r.u1()
        d.color_find, d.color_replace = _read_find_replace_pairs(r, count)
    elif opcode == 41:
        count = r.u1()
        d.texture_find, d.texture_replace = _read_find_replace_pairs(r, count)
    elif opcode == 42:
        r.s1()  # shift click drop index
    elif opcode == 43:
        _skip_subops(r)
    elif opcode == 44:
        d.inventory_model = r.u4()
    elif opcode in (46, 47, 49, 50, 51, 52, 53, 54):
        r.u4()  # gendered model / head model (extended)
    elif opcode == 65:
        pass  # geTradeable flag, no payload
    elif opcode == 75:
        d.weight = r.s2()
    elif opcode in (78, 79, 90, 91, 92, 93, 94):
        r.u2()  # model2 / head model / category
    elif opcode == 95:
        d.zan2d = r.u2()
    elif opcode == 97:
        d.noted_id = r.u2()
    elif opcode == 98:
        d.noted_template = r.u2()
    elif 100 <= opcode < 110:
        r.u2()  # count-obj id
        r.u2()  # count-obj amount
    elif opcode == 110:
        d.resize_x = r.u2()
    elif opcode == 111:
        d.resize_y = r.u2()
    elif opcode == 112:
        d.resize_z = r.u2()
    elif opcode == 113:
        d.ambient = r.s1()
    elif opcode == 114:
        d.contrast = r.s1()
    elif opcode == 115:
        d.team_id = r.u1()
    elif opcode in (139, 140):
        r.u2()  # bought id / bought template id
    elif opcode == 148:
        d.placeholder_id = r.u2()
    elif opcode == 149:
        d.placeholder_template = r.u2()
    elif opcode == 160:
        d.stackable = True
    elif opcode == 200:
        r.u1()
        r.u1()
        r.jstring()  # sub op
    elif opcode == 201:
        r.u1()
        r.u2()
        r.u2()
        r.u4()
        r.u4()
        r.jstring()  # conditional op
    elif opcode == 202:
        r.u1()
        r.u2()
        r.u2()
        r.u2()
        r.u4()
        r.u4()
        r.jstring()  # conditional sub op
    elif opcode == 249:
        _skip_params(r)
    else:
        raise ItemDecodeError(f"unknown item opcode {opcode} at pos {r.pos - 1}")


def _read_find_replace_pairs(
    r: DefinitionReader, count: int
) -> tuple[list[int], list[int]]:
    find: list[int] = []
    replace: list[int] = []
    for _ in range(count):
        find.append(r.u2())
        replace.append(r.u2())
    return find, replace


def _skip_subops(r: DefinitionReader) -> None:
    r.u1()  # op index
    while True:
        subop_id = r.u1()
        if subop_id == 0:
            break
        r.jstring()


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
