"""Item/NPC/object decoders tested against real definitions pulled from a live
OSRS cache build - id 995 ("Coins"), npc 8 ("Nechryael"), object 1 ("Crate")."""

from __future__ import annotations

from pathlib import Path

from app.definitions.item import decode_item
from app.definitions.npc import decode_npc
from app.definitions.object import decode_object
from app.js5.refindex import parse_reference_index

FIXTURES = Path(__file__).parent / "fixtures"


def test_decode_real_item() -> None:
    data = (FIXTURES / "item_995.bin").read_bytes()
    item = decode_item(995, data)
    assert item.name == "Coins"
    assert item.stackable is True
    assert item.value == 1


def test_decode_real_npc() -> None:
    data = (FIXTURES / "npc_8.bin").read_bytes()
    npc = decode_npc(8, data)
    assert npc.name == "Nechryael"
    assert npc.combat_level == 115


def test_decode_real_object() -> None:
    data = (FIXTURES / "object_1.bin").read_bytes()
    obj = decode_object(1, data)
    assert obj.name == "Crate"


def test_parse_reference_index_configs() -> None:
    data = (FIXTURES / "refindex_configs.bin").read_bytes()
    groups = parse_reference_index(data)
    by_id = {g.group_id: g for g in groups}
    assert len(by_id[9].file_ids) == len(set(by_id[9].file_ids))
    assert len(by_id[10].file_ids) == len(set(by_id[10].file_ids))
    assert len(by_id[6].file_ids) == len(set(by_id[6].file_ids))
