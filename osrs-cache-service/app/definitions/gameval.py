"""Decodes OSRS gameval symbol names (archive 24).

Ported field-for-field from RuneLite's ``GameValLoader.java``. Archive 24 keys a
group by namespace (items, npcs, objects, interfaces, ...) and a file by entity id;
each file resolves an id to its internal Jagex name - the human-readable id map.
Most namespaces store one name per file; dbtables (10) and interfaces (13/14) nest
sub-entries (columns, components) inside a file.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader

GAMEVAL_ARCHIVE = 24

NAMESPACES = {
    0: "items",
    1: "npcs",
    2: "inventories",
    3: "varps",
    4: "varbits",
    6: "objects",
    7: "animations",
    8: "spotanims",
    9: "dbrows",
    10: "dbtables",
    11: "jingles",
    12: "sprites",
    13: "interfaces_legacy",
    14: "interfaces",
    15: "varcs",
}


@dataclass(slots=True, frozen=True)
class GameValEntry:
    entry_id: int
    sub_id: int | None
    name: str


def decode_gameval(namespace_id: int, entry_id: int, data: bytes) -> list[GameValEntry]:
    if namespace_id == 10:
        return _decode_indexed(entry_id, data)
    if namespace_id == 13:
        return _decode_interfaces_legacy(entry_id, data)
    if namespace_id == 14:
        return _decode_interfaces(entry_id, data)
    return [GameValEntry(entry_id, None, data.decode("utf-8", errors="replace"))]


def _decode_indexed(entry_id: int, data: bytes) -> list[GameValEntry]:
    r = DefinitionReader(data)
    r.u1()
    entries = [GameValEntry(entry_id, None, r.jstring())]
    sub_id = 0
    while r.u1() != 0:
        entries.append(GameValEntry(entry_id, sub_id, r.jstring()))
        sub_id += 1
    return entries


def _decode_interfaces_legacy(entry_id: int, data: bytes) -> list[GameValEntry]:
    r = DefinitionReader(data)
    entries = [GameValEntry(entry_id, None, r.jstring())]
    end_idx = len(data) - 1
    while data[end_idx] != 0xFF:
        end_idx -= 1
    msb = 0
    while True:
        iid = r.u1()
        if iid == 0xFF and r.pos == end_idx + 1:
            break
        entries.append(GameValEntry(entry_id, msb | iid, r.jstring()))
        if iid == 0xFF:
            msb += 0x100
    return entries


def _decode_interfaces(entry_id: int, data: bytes) -> list[GameValEntry]:
    r = DefinitionReader(data)
    entries = [GameValEntry(entry_id, None, r.jstring())]
    while True:
        iid = r.u2()
        if iid == 0xFFFF:
            break
        entries.append(GameValEntry(entry_id, iid, r.jstring()))
    return entries
