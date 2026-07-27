"""Decodes an OSRS dbtable definition (config archive, dbtable group).

Ported field-for-field from RuneLite's ``DBTableLoader.java``. A dbtable is the
schema for Jagex's newer relational data tables: per-column script-var type lists
plus optional default values. ``decode_column_fields`` is shared with the dbrow
decoder, which stores actual row values against this same column layout.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.definitions.base import DefinitionReader

_STRING_TYPE = 36


class DBTableDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class DBColumn:
    types: list[int]
    default: list[int | str] | None = None


@dataclass(slots=True)
class DBTableDefinition:
    id: int
    columns: dict[int, DBColumn] = field(default_factory=dict)


def decode_column_fields(r: DefinitionReader, types: list[int]) -> list[int | str]:
    field_count = r.ushort_smart()
    values: list[int | str] = []
    for _ in range(field_count):
        values.extend(
            r.jstring() if type_id == _STRING_TYPE else r.s4() for type_id in types
        )
    return values


def decode_dbtable(dbtable_id: int, data: bytes) -> DBTableDefinition:
    r = DefinitionReader(data)
    d = DBTableDefinition(id=dbtable_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        if opcode == 1:
            _decode_columns(r, d)
        else:
            raise DBTableDecodeError(
                f"unknown dbtable opcode {opcode} at pos {r.pos - 1}"
            )

    return d


def _decode_columns(r: DefinitionReader, d: DBTableDefinition) -> None:
    r.u1()  # column count, bounded by the 255 terminator below
    setting = r.u1()
    while setting != 255:
        column_id = setting & 0x7F
        has_default = setting & 0x80 != 0
        types = [r.ushort_smart() for _ in range(r.u1())]
        default = decode_column_fields(r, types) if has_default else None
        d.columns[column_id] = DBColumn(types=types, default=default)
        setting = r.u1()
