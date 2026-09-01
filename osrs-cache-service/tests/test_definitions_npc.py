"""NPC opcodes that carry a list or a transform table, exercised against hand-built
streams matching the ``NpcLoader.java`` byte layout the decoder is ported from."""

from __future__ import annotations

from app.definitions.npc import decode_npc
from app.definitions.registry import REGISTRY


def _stream(*parts: bytes) -> bytes:
    return b"".join(parts) + b"\x00"


def test_decode_models_chatheads_and_actions() -> None:
    d = decode_npc(
        1,
        _stream(
            b"\x02Guard\x00",
            bytes([0x01, 0x02, 0x00, 0x64, 0x00, 0xC8]),
            bytes([0x3C, 0x01, 0x01, 0x2C]),
            b"\x1eTalk-to\x00",
            b"\x1fHidden\x00",
            b"\x20Attack\x00",
        ),
    )
    assert d.name == "Guard"
    assert d.model_ids == [100, 200]
    assert d.chathead_model_ids == [300]
    assert d.actions == ["Talk-to", None, "Attack", None, None]


def test_decode_wide_model_ids() -> None:
    d = decode_npc(
        2,
        _stream(
            bytes([0x3D, 0x01, 0x00, 0x00, 0x13, 0xD2]),
            bytes([0x3E, 0x01, 0x00, 0x00, 0x00, 0x2A]),
        ),
    )
    assert d.model_ids == [5074]
    assert d.chathead_model_ids == [42]


def test_decode_recolour_and_retexture() -> None:
    d = decode_npc(
        3,
        _stream(
            bytes([0x28, 0x01, 0x03, 0x9E, 0x00, 0x3D]),
            bytes([0x29, 0x01, 0x00, 0x05, 0x00, 0x06]),
        ),
    )
    assert d.color_find == [926]
    assert d.color_replace == [61]
    assert d.texture_find == [5]
    assert d.texture_replace == [6]


def test_decode_varbit_transform_has_no_fallback_form() -> None:
    d = decode_npc(
        4,
        _stream(bytes([0x6A, 0x13, 0x88, 0xFF, 0xFF, 0x01, 0x1B, 0x59, 0x1B, 0x5A])),
    )
    assert d.varbit_id == 5000
    assert d.varp_index is None
    assert d.configs == [7001, 7002, None]


def test_decode_varp_transform_carries_its_fallback_form() -> None:
    d = decode_npc(
        5, _stream(bytes([0x76, 0xFF, 0xFF, 0x00, 0x64, 0x1B, 0x58, 0x00, 0x1B, 0x59]))
    )
    assert d.varbit_id is None
    assert d.varp_index == 100
    assert d.configs == [7001, 7000]


def test_head_icon_bitfield_leaves_the_stream_aligned() -> None:
    d = decode_npc(
        6,
        _stream(
            bytes([0x66, 0x05, 0x00, 0x07, 0x03, 0x00, 0x09, 0x04]),
            b"\x02Rat\x00",
        ),
    )
    assert d.name == "Rat"


def test_row_builder_carries_every_decoded_field() -> None:
    d = decode_npc(
        7,
        _stream(
            b"\x02Guard\x00",
            bytes([0x01, 0x01, 0x00, 0x64]),
            bytes([0x6A, 0x13, 0x88, 0xFF, 0xFF, 0x00, 0x1B, 0x59]),
        ),
    )
    row = REGISTRY[9].to_row(1, d)
    assert row["model_ids"] == [100]
    assert row["varbit_id"] == 5000
    assert row["configs"] == [7001, None]
