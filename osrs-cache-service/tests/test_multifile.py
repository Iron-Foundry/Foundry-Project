"""Multi-file group splitting, tested with a synthetic single-stripe trailer."""

from __future__ import annotations

from app.js5.multifile import split_files


def _pack(files: dict[int, bytes]) -> bytes:
    ordered = list(files.items())
    body = b"".join(data for _, data in ordered)
    trailer = bytearray()
    prev_len = 0
    for _, data in ordered:
        length = len(data)
        trailer += (length - prev_len).to_bytes(4, "big", signed=True)
        prev_len = length
    return body + bytes(trailer) + bytes([1])


def test_split_single_file_is_passthrough() -> None:
    assert split_files(b"hello", [42]) == {42: b"hello"}


def test_split_multi_file_round_trips() -> None:
    files = {10: b"aaaa", 20: b"bb", 30: b"cccccc"}
    packed = _pack(files)
    assert split_files(packed, list(files)) == files


def test_split_empty_file_ids() -> None:
    assert split_files(b"", []) == {}
