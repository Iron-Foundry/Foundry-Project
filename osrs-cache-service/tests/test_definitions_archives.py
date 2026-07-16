"""Whole-archive decoders (dbtable index, gameval) exercised against hand-built
byte streams matching the RuneLite loader layout each is ported from."""

from __future__ import annotations

from app.definitions.dbtable_index import decode_dbtable_index
from app.definitions.gameval import decode_gameval


def test_decode_dbtable_index() -> None:
    data = bytes([0x01, 0x00, 0x01, 0, 0, 0, 0x64, 0x02, 0x0A, 0x0B])
    d = decode_dbtable_index(5, 2, data)
    assert d.table_id == 5
    assert d.column_id == 2
    assert len(d.tuples) == 1
    assert d.tuples[0].base_type == "integer"
    assert d.tuples[0].values == {100: [10, 11]}


def test_decode_gameval_simple_namespace() -> None:
    entries = decode_gameval(0, 20, b"twisted_bow")
    assert entries == [type(entries[0])(20, None, "twisted_bow")]


def test_decode_gameval_interfaces() -> None:
    data = bytes(
        [ord(c) for c in "iface"]
        + [0x00, 0x00, 0x05]
        + [ord(c) for c in "close"]
        + [0x00, 0xFF, 0xFF]
    )
    entries = decode_gameval(14, 100, data)
    assert (entries[0].entry_id, entries[0].sub_id, entries[0].name) == (
        100,
        None,
        "iface",
    )
    assert (entries[1].entry_id, entries[1].sub_id, entries[1].name) == (
        100,
        5,
        "close",
    )
