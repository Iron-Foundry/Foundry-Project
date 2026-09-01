"""Decodes an OSRS NPC definition (config archive, npc group).

Opcode-loop format, ported field-for-field from RuneLite's actual
``NpcLoader.java`` / ``EntityOpsLoader.java``. Every opcode is consumed with the
right width to keep the stream aligned even when its value isn't persisted.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader
from app.definitions.npc_ops import (
    read_action_slots,
    read_find_replace_pairs,
    read_model_ids,
    read_transform,
    skip_head_icons,
)


class NpcDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class NpcDefinition:
    id: int
    name: str = ""
    combat_level: int | None = None
    size: int | None = None
    category: int | None = None
    interactable: bool = True
    minimap_visible: bool = True
    model_ids: list[int] | None = None
    chathead_model_ids: list[int] | None = None
    actions: list[str | None] | None = None
    color_find: list[int] | None = None
    color_replace: list[int] | None = None
    texture_find: list[int] | None = None
    texture_replace: list[int] | None = None
    varbit_id: int | None = None
    varp_index: int | None = None
    configs: list[int | None] | None = None


def decode_npc(npc_id: int, data: bytes) -> NpcDefinition:
    r = DefinitionReader(data)
    d = NpcDefinition(id=npc_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        _decode_opcode(opcode, d, r)

    return d


def _decode_opcode(opcode: int, d: NpcDefinition, r: DefinitionReader) -> None:
    if opcode == 1:
        d.model_ids = read_model_ids(r, wide=False)
    elif opcode == 2:
        d.name = r.jstring()
    elif opcode == 12:
        d.size = r.u1()
    elif opcode in (13, 14, 15, 16):
        r.u2()  # standing / walking / idle rotate anims
    elif opcode == 17:
        r.skip(8)  # walk + rotate180/left/right anims (4 x u2)
    elif opcode == 18:
        d.category = r.u2()
    elif 30 <= opcode < 35:
        d.actions = read_action_slots(r, d.actions, opcode - 30)
    elif opcode == 40:
        d.color_find, d.color_replace = read_find_replace_pairs(r)
    elif opcode == 41:
        d.texture_find, d.texture_replace = read_find_replace_pairs(r)
    elif opcode == 60:
        d.chathead_model_ids = read_model_ids(r, wide=False)
    elif opcode == 61:
        d.model_ids = read_model_ids(r, wide=True)
    elif opcode == 62:
        d.chathead_model_ids = read_model_ids(r, wide=True)
    elif 74 <= opcode <= 79:
        r.u2()  # combat stat
    elif opcode == 93:
        d.minimap_visible = False
    elif opcode == 95:
        d.combat_level = r.u2()
    elif opcode in (97, 98):
        r.u2()  # width/height scale
    elif opcode == 99:
        pass  # render priority flag
    elif opcode in (100, 101):
        r.s1()  # ambient / contrast
    elif opcode == 102:
        skip_head_icons(r)
    elif opcode == 103:
        r.u2()  # rotation speed
    elif opcode in (106, 118):
        d.varbit_id, d.varp_index, d.configs = read_transform(
            r, has_default=opcode == 118
        )
    elif opcode == 107:
        d.interactable = False
    elif opcode == 109:
        pass  # rotation flag
    elif opcode == 111:
        pass  # follower/render priority flag
    elif opcode in (114, 116):
        r.u2()  # run / crawl animation
    elif opcode in (115, 117):
        r.skip(6)  # run/crawl + rotate180/left/right (3 more u2)
    elif opcode == 122:
        pass  # is follower
    elif opcode == 123:
        pass  # low priority follower ops
    elif opcode == 124:
        r.u2()  # height
    elif opcode == 126:
        r.u2()  # footprint size
    elif opcode == 129:
        pass  # unknown flag
    elif opcode == 130:
        pass  # idle anim restart
    elif opcode == 145:
        pass  # can hide for overlap
    elif opcode == 146:
        r.u2()  # overlap tint HSL
    elif opcode == 147:
        pass  # zbuf flag
    elif opcode == 249:
        r.params()
    elif opcode == 251:
        r.u1()
        r.u1()
        r.jstring()  # sub op
    elif opcode in (252, 253):
        r.u1()
        if opcode == 253:
            r.u2()
        r.u2()
        r.u2()
        r.u4()
        r.u4()
        r.jstring()  # conditional (sub) op
    else:
        raise NpcDecodeError(f"unknown npc opcode {opcode} at pos {r.pos - 1}")
