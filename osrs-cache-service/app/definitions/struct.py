"""Decodes an OSRS struct definition (config archive, struct group).

Ported field-for-field from RuneLite's ``StructLoader.java``. A struct is a bag of
parameters keyed by param id - the generic container behind most modern content
metadata. The single opcode 249 reads the standard parameter map.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.definitions.base import DefinitionReader


class StructDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class StructDefinition:
    id: int
    params: dict[int, int | str] = field(default_factory=dict)


def decode_struct(struct_id: int, data: bytes) -> StructDefinition:
    r = DefinitionReader(data)
    d = StructDefinition(id=struct_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        if opcode == 249:
            d.params = r.params()
        else:
            raise StructDecodeError(
                f"unknown struct opcode {opcode} at pos {r.pos - 1}"
            )

    return d
