"""Decodes a JS5 reference index (archive 255, group N describes archive N).

Reference indexes list which groups exist in an archive, and which files exist
within each group - information not present in the on-disk main_file_cache.idxN
files themselves. Direct port of OpenRS2's ``Js5Index.read`` (see
``org.openrs2.cache.Js5Index`` in github.com/openrs2/openrs2) - field order and the
2-or-4-byte "unsigned int smart" varint scheme are matched exactly, verified against
a real live OSRS cache build.
"""

from __future__ import annotations

from dataclasses import dataclass, field

_FLAG_NAMES = 0x01
_FLAG_DIGESTS = 0x02
_FLAG_LENGTHS = 0x04
_FLAG_UNCOMPRESSED_CHECKSUMS = 0x08

_PROTOCOL_SMART_MIN = 7  # Js5Protocol.SMART.id (OFFSET=5 + ordinal 2)
_PROTOCOL_VERSIONED_MIN = 6  # Js5Protocol.VERSIONED.id


@dataclass(slots=True)
class GroupRef:
    group_id: int
    file_ids: list[int] = field(default_factory=list)
    name_hash: int = -1


class _Reader:
    def __init__(self, data: bytes) -> None:
        self._data = data
        self._pos = 0

    def u1(self) -> int:
        v = self._data[self._pos]
        self._pos += 1
        return v

    def u2(self) -> int:
        v = int.from_bytes(self._data[self._pos : self._pos + 2], "big")
        self._pos += 2
        return v

    def u4(self) -> int:
        v = int.from_bytes(self._data[self._pos : self._pos + 4], "big")
        self._pos += 4
        return v

    def unsigned_int_smart(self) -> int:
        """2 bytes if the top bit of the first byte is clear, else 4 bytes (top bit masked)."""
        if self._data[self._pos] & 0x80 == 0:
            return self.u2()
        return self.u4() & 0x7FFFFFFF

    def skip(self, n: int) -> None:
        self._pos += n


def parse_reference_index(data: bytes) -> list[GroupRef]:
    r = _Reader(data)
    protocol = r.u1()
    if protocol < 5 or protocol > 7:
        raise ValueError(f"unsupported reference index protocol: {protocol}")

    read = r.unsigned_int_smart if protocol >= _PROTOCOL_SMART_MIN else r.u2

    if protocol >= _PROTOCOL_VERSIONED_MIN:
        r.u4()  # revision, unused
    flags = r.u1()
    group_count = read()

    group_ids = _delta_decode(r, group_count, read)
    groups = [GroupRef(group_id=gid) for gid in group_ids]

    if flags & _FLAG_NAMES:
        for group in groups:
            group.name_hash = r.u4()
    r.skip(4 * group_count)  # crcs, unused
    if flags & _FLAG_UNCOMPRESSED_CHECKSUMS:
        r.skip(4 * group_count)  # secondary crc, unused
    if flags & _FLAG_DIGESTS:
        r.skip(64 * group_count)  # whirlpool digests, unused
    if flags & _FLAG_LENGTHS:
        r.skip(8 * group_count)  # compressed + uncompressed lengths, unused
    r.skip(4 * group_count)  # versions, unused

    file_counts = [read() for _ in range(group_count)]

    for i, count in enumerate(file_counts):
        groups[i].file_ids.extend(_delta_decode(r, count, read))

    if flags & _FLAG_NAMES:
        for count in file_counts:
            r.skip(4 * count)  # file name hashes, unused

    return groups


def _delta_decode(r: _Reader, count: int, read) -> list[int]:  # noqa: ANN001
    value = 0
    ids: list[int] = []
    for _ in range(count):
        value += read()
        ids.append(value)
    return ids
