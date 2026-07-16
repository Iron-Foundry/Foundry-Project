"""Container decompression tested against real, small groups pulled from a live
OSRS cache build (fixtures captured under tests/fixtures/, not synthetic data)."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.js5.container import ContainerDecodeError, decompress

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize(
    "filename",
    [
        "group_gzip_a0_g2.bin",
        "group_bzip2_a0_g22.bin",
        "group_none_a8_g5689.bin",
    ],
)
def test_decompress_real_group(filename: str) -> None:
    raw = (FIXTURES / filename).read_bytes()
    container = decompress(raw)
    assert len(container.data) > 0


def test_decompress_rejects_short_buffer() -> None:
    with pytest.raises(ContainerDecodeError):
        decompress(b"\x00\x00")


def test_decompress_rejects_unknown_compression() -> None:
    header = bytes([9]) + (10).to_bytes(4, "big") + b"\x00" * 10
    with pytest.raises(ContainerDecodeError):
        decompress(header)
