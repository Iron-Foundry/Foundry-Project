"""Synthetic sector-chasing tests for Js5Store (no need for a full real cache)."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.js5.index import parse_index
from app.js5.store import CorruptSectorError, Js5Store

_SECTOR_SIZE = 520
_HEADER_SIZE = 8
_DATA_CAPACITY = _SECTOR_SIZE - _HEADER_SIZE


def _make_sector(
    group: int, chunk: int, next_sector: int, archive: int, data: bytes
) -> bytes:
    header = (
        group.to_bytes(2, "big")
        + chunk.to_bytes(2, "big")
        + next_sector.to_bytes(3, "big")
        + archive.to_bytes(1, "big")
    )
    return header + data.ljust(_DATA_CAPACITY, b"\x00")[:_DATA_CAPACITY]


def _make_index_entry(size: int, first_sector: int) -> bytes:
    return size.to_bytes(3, "big") + first_sector.to_bytes(3, "big")


def test_parse_index_reports_size_and_first_sector() -> None:
    data = _make_index_entry(0, 0) + _make_index_entry(100, 2)
    entries = parse_index(data)
    assert len(entries) == 2
    assert entries[0].exists is False
    assert entries[1].size == 100
    assert entries[1].first_sector == 2


def test_store_reads_single_sector_group(tmp_path: Path) -> None:
    archive = 3
    group = 0
    payload = b"hello osrs cache"
    dat2 = _make_sector(group, 0, 0, archive, payload)
    dat2_path = tmp_path / "main_file_cache.dat2"
    dat2_path.write_bytes(dat2)

    idx_path = tmp_path / "main_file_cache.idx3"
    idx_path.write_bytes(_make_index_entry(len(payload), 0))

    with Js5Store(dat2_path, {archive: idx_path}) as store:
        assert store.read(archive, group) == payload


def test_store_reads_multi_sector_group(tmp_path: Path) -> None:
    archive = 1
    group = 5
    part_a = b"a" * _DATA_CAPACITY
    part_b = b"bbbb"
    total_size = len(part_a) + len(part_b)

    sector0 = _make_sector(group, 0, 1, archive, part_a)
    sector1 = _make_sector(group, 1, 0, archive, part_b)
    dat2_path = tmp_path / "main_file_cache.dat2"
    dat2_path.write_bytes(sector0 + sector1)

    idx_path = tmp_path / "main_file_cache.idx1"
    idx_path.write_bytes(
        _make_index_entry(0, 0) * group + _make_index_entry(total_size, 0)
    )

    with Js5Store(dat2_path, {archive: idx_path}) as store:
        assert store.read(archive, group) == part_a + part_b


def test_store_detects_corrupt_chain(tmp_path: Path) -> None:
    archive = 1
    group = 0
    # header claims a different group id than requested -> corruption
    sector = _make_sector(group + 1, 0, 0, archive, b"x" * 10)
    dat2_path = tmp_path / "main_file_cache.dat2"
    dat2_path.write_bytes(sector)

    idx_path = tmp_path / "main_file_cache.idx1"
    idx_path.write_bytes(_make_index_entry(10, 0))

    with Js5Store(dat2_path, {archive: idx_path}) as store:
        with pytest.raises(CorruptSectorError):
            store.read(archive, group)
