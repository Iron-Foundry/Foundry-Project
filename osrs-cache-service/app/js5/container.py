"""JS5 container header parsing + decompression (none / gzip / bzip2).

Format: 1 byte compression type, 4 byte compressed length (big-endian), then for
compressed types a 4 byte uncompressed length, then the payload. An optional trailing
2-byte revision/version may follow the payload - it is returned but not part of the data.

Port of RuneLite's ``net.runelite.cache.fs.Container`` / OpenRS2's ``Js5Compression``.
"""

from __future__ import annotations

import bz2
import gzip
from dataclasses import dataclass

_COMPRESSION_NONE = 0
_COMPRESSION_BZIP2 = 1
_COMPRESSION_GZIP = 2
_COMPRESSION_LZMA = 3

_BZIP2_MAGIC = b"BZh1"


class ContainerDecodeError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class Container:
    data: bytes
    version: int | None


def decompress(raw: bytes) -> Container:
    if len(raw) < 5:
        raise ContainerDecodeError(f"container too short: {len(raw)} bytes")
    compression = raw[0]
    compressed_length = int.from_bytes(raw[1:5], "big")
    offset = 5

    if compression == _COMPRESSION_NONE:
        data = raw[offset : offset + compressed_length]
        offset += compressed_length
    else:
        if len(raw) < offset + 4:
            raise ContainerDecodeError("container missing uncompressed length")
        uncompressed_length = int.from_bytes(raw[offset : offset + 4], "big")
        offset += 4
        payload = raw[offset : offset + compressed_length]
        offset += compressed_length
        data = _decompress_payload(compression, payload, uncompressed_length)

    version: int | None = None
    if len(raw) - offset >= 2:
        version = int.from_bytes(raw[offset : offset + 2], "big")

    return Container(data=data, version=version)


def _decompress_payload(
    compression: int, payload: bytes, uncompressed_length: int
) -> bytes:
    if compression == _COMPRESSION_GZIP:
        data = gzip.decompress(payload)
    elif compression == _COMPRESSION_BZIP2:
        data = bz2.decompress(_BZIP2_MAGIC + payload)
    elif compression == _COMPRESSION_LZMA:
        raise ContainerDecodeError("LZMA containers are not yet supported")
    else:
        raise ContainerDecodeError(f"unknown compression type: {compression}")

    if len(data) != uncompressed_length:
        raise ContainerDecodeError(
            f"uncompressed length mismatch: expected {uncompressed_length}, got {len(data)}"
        )
    return data
