"""Decodes a map square's locations file (archive 5, file 1).

Ported from RuneLite's ``LocationsLoader.java``. Two nested delta streams: object
ids ascend by ``uint_smart_short_compat`` deltas, and within each id, packed
positions ascend by ``ushort_smart`` deltas biased by one. Both terminate on a
zero delta.

These groups are XTEA-encrypted in older caches. They are **not** in the current
live build - the plaintext decodes byte-exact - so no key handling happens here.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader


class LocationDecodeError(RuntimeError):
    pass


@dataclass(slots=True, frozen=True)
class Location:
    object_id: int
    plane: int
    local_x: int
    local_y: int
    shape: int
    orientation: int


def decode_locations(data: bytes) -> list[Location]:
    locations: list[Location] = []
    r = DefinitionReader(data)

    try:
        object_id = -1
        while True:
            id_delta = r.uint_smart_short_compat()
            if id_delta == 0:
                break
            object_id += id_delta
            _decode_positions(r, object_id, locations)
    except IndexError as exc:
        raise LocationDecodeError("locations stream ended early") from exc

    return locations


def _decode_positions(
    r: DefinitionReader, object_id: int, locations: list[Location]
) -> None:
    position = 0
    while True:
        position_delta = r.ushort_smart()
        if position_delta == 0:
            return
        position += position_delta - 1
        attributes = r.u1()
        locations.append(
            Location(
                object_id=object_id,
                plane=(position >> 12) & 0x3,
                local_x=(position >> 6) & 0x3F,
                local_y=position & 0x3F,
                shape=attributes >> 2,
                orientation=attributes & 0x3,
            )
        )
