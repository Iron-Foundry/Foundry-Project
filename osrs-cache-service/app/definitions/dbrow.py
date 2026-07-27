"""Decodes an OSRS dbrow definition (config archive, dbrow group).

Ported field-for-field from RuneLite's ``DBRowLoader.java``. A dbrow is one record
of a dbtable: per-column type lists plus the actual values, decoded with the shared
``decode_column_fields`` from the dbtable decoder, and the id of the owning table.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.definitions.base import DefinitionReader
from app.definitions.dbtable import decode_column_fields


class DBRowDecodeError(RuntimeError):
    pass


@dataclass(slots=True)
class DBRowColumn:
    types: list[int]
    values: list[int | str]


@dataclass(slots=True)
class DBRowDefinition:
    id: int
    table_id: int | None = None
    columns: dict[int, DBRowColumn] = field(default_factory=dict)


def decode_dbrow(dbrow_id: int, data: bytes) -> DBRowDefinition:
    r = DefinitionReader(data)
    d = DBRowDefinition(id=dbrow_id)

    while r.has_more():
        opcode = r.u1()
        if opcode == 0:
            break
        if opcode == 3:
            _decode_columns(r, d)
        elif opcode == 4:
            d.table_id = r.var_int2()
        else:
            raise DBRowDecodeError(f"unknown dbrow opcode {opcode} at pos {r.pos - 1}")

    return d


def _decode_columns(r: DefinitionReader, d: DBRowDefinition) -> None:
    r.u1()  # column count, bounded by the 255 terminator below
    column_id = r.u1()
    while column_id != 255:
        types = [r.ushort_smart() for _ in range(r.u1())]
        values = decode_column_fields(r, types)
        d.columns[column_id] = DBRowColumn(types=types, values=values)
        column_id = r.u1()
