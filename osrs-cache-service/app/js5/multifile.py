"""Splits a decompressed JS5 group's bytes into its individual files.

Many groups (notably config archives: item/npc/object/... definitions) bundle
several files together using a trailing delta-encoded length table. Port of
RuneLite's ``net.runelite.cache.fs.Container``-adjacent archive-splitting logic.
"""

from __future__ import annotations


def split_files(data: bytes, file_ids: list[int]) -> dict[int, bytes]:
    if len(file_ids) == 1:
        return {file_ids[0]: data}
    if not file_ids:
        return {}

    n = len(file_ids)
    chunks = data[-1]
    trailer_start = len(data) - 1 - chunks * n * 4
    if trailer_start < 0:
        raise ValueError("multi-file group trailer out of range")

    sizes = [0] * n
    chunk_sizes = [[0] * n for _ in range(chunks)]
    pos = trailer_start
    for c in range(chunks):
        running = 0
        for f in range(n):
            delta = int.from_bytes(data[pos : pos + 4], "big", signed=True)
            pos += 4
            running += delta
            chunk_sizes[c][f] = running
            sizes[f] += running

    out = [bytearray(size) for size in sizes]
    offsets = [0] * n
    cursor = 0
    for c in range(chunks):
        for f in range(n):
            size = chunk_sizes[c][f]
            out[f][offsets[f] : offsets[f] + size] = data[cursor : cursor + size]
            offsets[f] += size
            cursor += size

    return {file_ids[f]: bytes(out[f]) for f in range(n)}
