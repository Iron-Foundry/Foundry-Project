"""Varbit decoder tested against a real definition from a live OSRS cache build."""

from __future__ import annotations

from pathlib import Path

from app.definitions.varbit import decode_varbit

FIXTURES = Path(__file__).parent / "fixtures"


def test_decode_real_varbit() -> None:
    data = (FIXTURES / "varbit_0.bin").read_bytes()
    varbit = decode_varbit(0, data)
    assert varbit.varp_index is not None
    assert varbit.least_significant_bit is not None
    assert varbit.most_significant_bit is not None
