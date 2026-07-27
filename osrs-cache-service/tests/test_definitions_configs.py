"""Config-group decoders exercised against hand-built opcode streams matching the
RuneLite loader byte layout each decoder is ported from."""

from __future__ import annotations

from app.definitions.dbrow import decode_dbrow
from app.definitions.dbtable import decode_dbtable
from app.definitions.enum_def import decode_enum
from app.definitions.struct import decode_struct
from app.definitions.variables import (
    decode_varclient,
    decode_varclientstring,
    decode_varplayer,
)


def test_decode_enum() -> None:
    data = bytes(
        [
            *[0x01, ord("i"), 0x02, ord("i"), 0x04, 0, 0, 0, 7, 0x06, 0, 2],
            *[0, 0, 0, 1, 0, 0, 0, 10, 0, 0, 0, 2, 0, 0, 0, 20, 0x00],
        ]
    )
    d = decode_enum(3, data)
    assert d.key_type == "i"
    assert d.value_type == "i"
    assert d.default_int == 7
    assert d.entries == {1: 10, 2: 20}


def test_decode_struct() -> None:
    data = bytes(
        [
            *[0xF9, 2, 0, 0, 0, 0x64, 0, 0, 0, 5, 1, 0, 0, 0xC8],
            *[ord("h"), ord("i"), 0x00, 0x00],
        ]
    )
    d = decode_struct(1, data)
    assert d.params == {100: 5, 200: "hi"}


def test_decode_varplayer() -> None:
    d = decode_varplayer(4, bytes([0x05, 0x01, 0x2C, 0x00]))
    assert d.type == 300


def test_decode_varclient_and_string() -> None:
    assert decode_varclient(1, bytes([0x02, 0x00])).persist is True
    assert decode_varclientstring(1, bytes([0x00])).persist is False


def test_decode_dbtable() -> None:
    data = bytes([0x01, 0x01, 0x80, 0x01, 0x24, 0x01, ord("x"), 0x00, 0xFF, 0x00])
    d = decode_dbtable(2, data)
    assert 0 in d.columns
    assert d.columns[0].types == [36]
    assert d.columns[0].default == ["x"]


def test_decode_dbrow() -> None:
    data = bytes(
        [0x03, 0x01, 0x00, 0x01, 0x00, 0x01, 0, 0, 0, 9, 0xFF, 0x04, 0x05, 0x00]
    )
    d = decode_dbrow(7, data)
    assert d.table_id == 5
    assert d.columns[0].types == [0]
    assert d.columns[0].values == [9]
