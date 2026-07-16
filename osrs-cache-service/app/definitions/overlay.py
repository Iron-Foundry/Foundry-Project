"""Decodes an OSRS overlay (floor detail) definition - config archive, group 4.

Ported from RuneLite's ``OverlayLoader.java``. ``rgb == 0xFF00FF`` is a sentinel
meaning "no colour": such an overlay draws nothing and the underlay shows through.
``hide_underlay`` defaults to true and is only cleared by opcode 5.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader

NO_COLOR = 0xFF00FF


class OverlayDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class OverlayDefinition:
    id: int
    rgb: int = 0
    texture: int = -1
    hide_underlay: bool = True
    secondary_rgb: int = -1


def decode_overlay(overlay_id: int, data: bytes) -> OverlayDefinition:
    r = DefinitionReader(data)
    d = OverlayDefinition(id=overlay_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        _decode_opcode(opcode, d, r)

    return d


def _decode_opcode(opcode: int, d: OverlayDefinition, r: DefinitionReader) -> None:
    if opcode == 1:
        d.rgb = r.u3()
    elif opcode == 2:
        d.texture = r.u1()
    elif opcode == 5:
        d.hide_underlay = False
    elif opcode == 7:
        d.secondary_rgb = r.u3()
    else:
        raise OverlayDecodeError(f"unknown overlay opcode {opcode} at pos {r.pos - 1}")
