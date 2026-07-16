"""Parses main_file_cache.idxN files: a flat table of (size, first_sector) per group."""

from __future__ import annotations

from dataclasses import dataclass

_ENTRY_SIZE = 6


@dataclass(frozen=True, slots=True)
class IndexEntry:
    group: int
    size: int
    first_sector: int

    @property
    def exists(self) -> bool:
        return self.size > 0


def parse_index(data: bytes) -> list[IndexEntry]:
    """Parse an idxN file's raw bytes into one IndexEntry per group id."""
    count = len(data) // _ENTRY_SIZE
    entries: list[IndexEntry] = []
    for group in range(count):
        offset = group * _ENTRY_SIZE
        size = int.from_bytes(data[offset : offset + 3], "big")
        first_sector = int.from_bytes(data[offset + 3 : offset + 6], "big")
        entries.append(IndexEntry(group=group, size=size, first_sector=first_sector))
    return entries
