"""Decodes an OSRS dbtable index (archive 21).

Ported field-for-field from RuneLite's ``DBTableIndexLoader.java``. Archive 21 keys
a group by table id and a file by column id; each file is a value -> row-id lookup
built over a tuple of base-typed values, accelerating dbrow queries by column value.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.definitions.base import DefinitionReader

DBTABLE_INDEX_ARCHIVE = 21

_BASE_TYPES = {0: "integer", 1: "long", 2: "string"}


@dataclass(slots=True)
class DBIndexTuple:
    base_type: str
    values: dict[int | str, list[int]] = field(default_factory=dict)


@dataclass(slots=True)
class DBTableIndexDefinition:
    table_id: int
    column_id: int
    tuples: list[DBIndexTuple] = field(default_factory=list)


def _decode_value(reader: DefinitionReader, base_type: str) -> int | str:
    if base_type == "long":
        return reader.s8()
    if base_type == "string":
        return reader.jstring()
    return reader.s4()


def decode_dbtable_index(
    table_id: int, column_id: int, data: bytes
) -> DBTableIndexDefinition:
    r = DefinitionReader(data)
    d = DBTableIndexDefinition(table_id=table_id, column_id=column_id)

    for _ in range(r.var_int2()):
        base_type = _BASE_TYPES.get(r.u1(), "integer")
        entry = DBIndexTuple(base_type=base_type)
        for _ in range(r.var_int2()):
            value = _decode_value(r, base_type)
            entry.values[value] = [r.var_int2() for _ in range(r.var_int2())]
        d.tuples.append(entry)

    return d
