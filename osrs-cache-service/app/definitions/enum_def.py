"""Decodes an OSRS enum definition (config archive, enum group).

Ported field-for-field from RuneLite's ``EnumLoader.java``. An enum is a typed
key -> value lookup table; the key and value types are single-char script-var
codes, and entries arrive as string, int, or long pairs depending on the opcode.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.definitions.base import DefinitionReader


class EnumDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class EnumDefinition:
    id: int
    key_type: str | None = None
    value_type: str | None = None
    default_int: int | None = None
    default_string: str | None = None
    entries: dict[int, int | str] = field(default_factory=dict)


def decode_enum(enum_id: int, data: bytes) -> EnumDefinition:
    r = DefinitionReader(data)
    d = EnumDefinition(id=enum_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        if opcode == 1:
            d.key_type = chr(r.u1())
        elif opcode == 2:
            d.value_type = chr(r.u1())
        elif opcode == 3:
            d.default_string = r.jstring()
        elif opcode == 4:
            d.default_int = r.s4()
        elif opcode == 5:
            for _ in range(r.u2()):
                key = r.s4()
                d.entries[key] = r.jstring()
        elif opcode == 6:
            for _ in range(r.u2()):
                key = r.s4()
                d.entries[key] = r.s4()
        elif opcode == 7:
            for _ in range(r.u2()):
                key = r.s4()
                d.entries[key] = r.s8()
        elif opcode == 8:
            d.default_int = r.s8()
        else:
            raise EnumDecodeError(f"unknown enum opcode {opcode} at pos {r.pos - 1}")

    return d
