"""Decodes an OSRS varbit definition (config archive, varbit group).

Ported field-for-field from RuneLite's ``VarbitLoader.java`` - the simplest
config type: a varp index plus a bit range within it.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader


class VarbitDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class VarbitDefinition:
    id: int
    varp_index: int | None = None
    least_significant_bit: int | None = None
    most_significant_bit: int | None = None


def decode_varbit(varbit_id: int, data: bytes) -> VarbitDefinition:
    r = DefinitionReader(data)
    d = VarbitDefinition(id=varbit_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        elif opcode == 1:
            d.varp_index = r.u2()
            d.least_significant_bit = r.u1()
            d.most_significant_bit = r.u1()
        else:
            raise VarbitDecodeError(
                f"unknown varbit opcode {opcode} at pos {r.pos - 1}"
            )

    return d
