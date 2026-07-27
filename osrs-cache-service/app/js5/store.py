"""Reads raw group bytes out of main_file_cache.dat2 given index tables.

Ports the disk-store sector-chasing logic from RuneLite's ``net.runelite.cache.fs.Store``
and OpenRS2's ``org.openrs2.cache.Store`` - see osrs-cache-service/CLAUDE.md.
"""

from __future__ import annotations

from pathlib import Path

from app.js5.index import IndexEntry, parse_index

_SECTOR_SIZE = 520
_HEADER_SIZE_NORMAL = 8
_HEADER_SIZE_EXTENDED = 10
_EXTENDED_GROUP_THRESHOLD = 65536


class CorruptSectorError(RuntimeError):
    pass


class Js5Store:
    """Random-access reader over a single main_file_cache.dat2, indexed by main_file_cache.idxN."""

    def __init__(self, dat2_path: Path, index_paths: dict[int, Path]) -> None:
        self._dat2 = dat2_path.open("rb")
        self._indexes: dict[int, list[IndexEntry]] = {
            archive: parse_index(path.read_bytes())
            for archive, path in index_paths.items()
        }

    def close(self) -> None:
        self._dat2.close()

    def __enter__(self) -> Js5Store:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def archives(self) -> list[int]:
        return sorted(self._indexes)

    def groups(self, archive: int) -> list[IndexEntry]:
        return [e for e in self._indexes.get(archive, []) if e.exists]

    def read(self, archive: int, group: int) -> bytes:
        entries = self._indexes.get(archive)
        if entries is None or group >= len(entries) or not entries[group].exists:
            raise KeyError(f"no such group: archive={archive} group={group}")
        entry = entries[group]
        extended = group >= _EXTENDED_GROUP_THRESHOLD
        header_size = _HEADER_SIZE_EXTENDED if extended else _HEADER_SIZE_NORMAL
        data_capacity = _SECTOR_SIZE - header_size

        out = bytearray()
        sector = entry.first_sector
        chunk = 0
        remaining = entry.size
        while remaining > 0:
            if sector == 0 and chunk > 0:
                raise CorruptSectorError(
                    f"unexpected end of sector chain: archive={archive} group={group}"
                )
            self._dat2.seek(sector * _SECTOR_SIZE)
            raw = self._dat2.read(_SECTOR_SIZE)
            if len(raw) < header_size:
                raise CorruptSectorError(
                    f"truncated sector: archive={archive} group={group} sector={sector}"
                )
            header_group, header_chunk, next_sector, header_archive = _parse_header(
                raw, extended
            )
            if (
                header_group != group
                or header_chunk != chunk
                or header_archive != archive
            ):
                raise CorruptSectorError(
                    f"sector header mismatch: archive={archive} group={group} "
                    f"chunk={chunk} sector={sector} got=({header_group},{header_chunk},{header_archive})"
                )
            take = min(remaining, data_capacity)
            out += raw[header_size : header_size + take]
            remaining -= take
            sector = next_sector
            chunk += 1
        return bytes(out)


def _parse_header(raw: bytes, extended: bool) -> tuple[int, int, int, int]:
    if extended:
        group = int.from_bytes(raw[0:4], "big")
        chunk = int.from_bytes(raw[4:6], "big")
        next_sector = int.from_bytes(raw[6:9], "big")
        archive = raw[9]
    else:
        group = int.from_bytes(raw[0:2], "big")
        chunk = int.from_bytes(raw[2:4], "big")
        next_sector = int.from_bytes(raw[4:7], "big")
        archive = raw[7]
    return group, chunk, next_sector, archive
