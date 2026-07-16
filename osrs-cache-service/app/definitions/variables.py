"""Decodes the OSRS variable config types: varplayer, varclient, varclientstring.

varplayer (group 16) is ported from the deobfuscated client ``VarpDefinition`` -
opcode 5 carries the varp's type. varclient (group 19) and varclientstring
(group 15) carry only a persistence flag (opcode 2), matching the client's varc
config decode. Decoding all three completes the var system alongside varbit.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader


class VariableDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class VarPlayerDefinition:
    id: int
    type: int | None = None


@dataclass(slots=True)
class VarClientDefinition:
    id: int
    persist: bool = False


def decode_varplayer(varp_id: int, data: bytes) -> VarPlayerDefinition:
    r = DefinitionReader(data)
    d = VarPlayerDefinition(id=varp_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        elif opcode == 5:
            d.type = r.u2()
        else:
            raise VariableDecodeError(
                f"unknown varplayer opcode {opcode} at pos {r.pos - 1}"
            )

    return d


def _decode_varc(kind: str, varc_id: int, data: bytes) -> VarClientDefinition:
    r = DefinitionReader(data)
    d = VarClientDefinition(id=varc_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        elif opcode == 2:
            d.persist = True
        else:
            raise VariableDecodeError(
                f"unknown {kind} opcode {opcode} at pos {r.pos - 1}"
            )

    return d


def decode_varclient(varc_id: int, data: bytes) -> VarClientDefinition:
    return _decode_varc("varclient", varc_id, data)


def decode_varclientstring(varc_id: int, data: bytes) -> VarClientDefinition:
    return _decode_varc("varclientstring", varc_id, data)
