"""Multi-value NPC opcode readers, split out of ``npc.py`` to keep it under the
file size limit.

Each reader consumes exactly the bytes RuneLite's ``NpcLoader.java`` consumes for
its opcode and returns the value the definition keeps.
"""

from __future__ import annotations

from app.definitions.base import DefinitionReader

ACTION_SLOTS = 5

_UNSET = 65535


def read_model_ids(r: DefinitionReader, wide: bool) -> list[int]:
    """A count byte then one model id each: u2, or a full int for opcodes 61/62."""
    count = r.u1()
    return [r.s4() if wide else r.u2() for _ in range(count)]


def read_find_replace_pairs(r: DefinitionReader) -> tuple[list[int], list[int]]:
    """A count byte then (find, replace) short pairs, recolour and retexture alike."""
    count = r.u1()
    find: list[int] = []
    replace: list[int] = []
    for _ in range(count):
        find.append(r.u2())
        replace.append(r.u2())
    return find, replace


def read_action_slots(
    r: DefinitionReader, actions: list[str | None] | None, index: int
) -> list[str | None]:
    """One right-click option into its own slot of the five.

    "Hidden" leaves the slot empty, per EntityOpsLoader.
    """
    slots: list[str | None] = actions if actions is not None else [None] * ACTION_SLOTS
    text = r.jstring()
    if text.lower() != "hidden":
        slots[index] = text
    return slots


def read_transform(
    r: DefinitionReader, has_default: bool
) -> tuple[int | None, int | None, list[int | None]]:
    """The varbit/varp driven form table.

    The varbit or varp value indexes the returned list to pick which npc id this
    definition really is. The last entry is the form used when that value falls
    outside the table - opcode 118 carries it as an extra short, opcode 106 has none.
    """
    varbit_id = _or_none(r.u2())
    varp_index = _or_none(r.u2())
    fallback = _or_none(r.u2()) if has_default else None
    count = r.u1()
    configs: list[int | None] = [_or_none(r.u2()) for _ in range(count + 1)]
    configs.append(fallback)
    return varbit_id, varp_index, configs


def skip_head_icons(r: DefinitionReader) -> None:
    bitfield = r.u1()
    for i in range(bitfield.bit_length()):
        if bitfield & (1 << i):
            r.big_smart2()
            r.ushort_smart_minus_one()


def _or_none(value: int) -> int | None:
    return None if value == _UNSET else value
