"""Decodes an OSRS underlay (floor) definition - config archive, group 1.

Ported from RuneLite's ``UnderlayLoader.java``. A single opcode carrying a
24-bit RGB; the client derives HSL from it at load time (see
``app/maps/render/jagex_color.py``).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader


class UnderlayDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class UnderlayDefinition:
    id: int
    rgb: int = 0


def decode_underlay(underlay_id: int, data: bytes) -> UnderlayDefinition:
    r = DefinitionReader(data)
    d = UnderlayDefinition(id=underlay_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        if opcode == 1:
            d.rgb = r.u3()
        else:
            raise UnderlayDecodeError(
                f"unknown underlay opcode {opcode} at pos {r.pos - 1}"
            )

    return d
