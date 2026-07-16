"""XTEA cipher self-consistency tests.

NOTE: exhaustively brute-forced against real encrypted map groups from an older
live OSRS cache build (endianness, key order, block order, cipher direction) with
no match - the newest live cache build has no active map encryption to validate
against either. This cipher is a canonical, self-consistent XTEA (32 rounds,
matches the standard Wheeler/Needham reference implementation) but its exact
application to OSRS map data is unverified. See osrs-cache-service/CLAUDE.md.
"""

from __future__ import annotations

import os

import pytest

from app.js5.xtea import _decrypt_block, decrypt


def _encrypt_block(v0: int, v1: int, key: list[int]) -> tuple[int, int]:
    delta = 0x9E3779B9
    mask = 0xFFFFFFFF
    total = 0
    for _ in range(32):
        v0 = (v0 + ((((v1 << 4) ^ (v1 >> 5)) + v1) ^ (total + key[total & 3]))) & mask
        total = (total + delta) & mask
        v1 = (
            v1 + ((((v0 << 4) ^ (v0 >> 5)) + v0) ^ (total + key[(total >> 11) & 3]))
        ) & mask
    return v0, v1


def test_block_round_trip() -> None:
    key = [0x11223344, 0x55667788, 0x99AABBCC, 0xDDEEFF00]
    v0, v1 = 0x41424344, 0x45464748
    e0, e1 = _encrypt_block(v0, v1, key)
    d0, d1 = _decrypt_block(e0, e1, key)
    assert (d0, d1) == (v0, v1)


def test_decrypt_leaves_trailing_partial_block_untouched() -> None:
    key = [1, 2, 3, 4]
    data = os.urandom(8) + b"\x01\x02\x03"
    out = decrypt(data, key)
    assert out[8:] == data[8:]
    assert len(out) == len(data)


def test_decrypt_rejects_bad_key_length() -> None:
    with pytest.raises(ValueError):
        decrypt(b"\x00" * 8, [1, 2, 3])
