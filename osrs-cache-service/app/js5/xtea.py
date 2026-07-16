"""XTEA block decryption for encrypted map location groups.

OSRS encrypts the raw container bytes of "locations" groups in the maps archive with
XTEA, keyed per map square. Only whole 8-byte blocks are encrypted; any trailing
remainder is left as-is. See osrs-cache-service/CLAUDE.md.
"""

from __future__ import annotations

_DELTA = 0x9E3779B9
_MASK32 = 0xFFFFFFFF
_ROUNDS = 32


def decrypt(data: bytes, key: list[int]) -> bytes:
    if len(key) != 4:
        raise ValueError("XTEA key must have exactly 4 32-bit words")

    block_count = len(data) // 8
    out = bytearray(data)
    for block in range(block_count):
        offset = block * 8
        v0 = int.from_bytes(out[offset : offset + 4], "big")
        v1 = int.from_bytes(out[offset + 4 : offset + 8], "big")
        v0, v1 = _decrypt_block(v0, v1, key)
        out[offset : offset + 4] = v0.to_bytes(4, "big")
        out[offset + 4 : offset + 8] = v1.to_bytes(4, "big")
    return bytes(out)


def _decrypt_block(v0: int, v1: int, key: list[int]) -> tuple[int, int]:
    total = (_DELTA * _ROUNDS) & _MASK32
    for _ in range(_ROUNDS):
        v1 = (
            v1 - ((((v0 << 4) ^ (v0 >> 5)) + v0) ^ (total + key[(total >> 11) & 3]))
        ) & _MASK32
        total = (total - _DELTA) & _MASK32
        v0 = (
            v0 - ((((v1 << 4) ^ (v1 >> 5)) + v1) ^ (total + key[total & 3]))
        ) & _MASK32
    return v0, v1
