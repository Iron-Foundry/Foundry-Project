"""Decodes a map square's terrain file (archive 5, file 0).

Ported from RuneLite's ``MapLoader.java`` at its current revision. This is the
**post-209 short form**: the per-tile attribute is a u2 and the overlay id is an s2.
Pre-2022 sources describe both as single bytes - decoding with those widths desyncs
the stream immediately.

The tile loop order is plane, x, y with y innermost. Transposing it mirrors the
world without failing, so it will not show up as an exception - only on sight.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.definitions.base import DefinitionReader
from app.maps.constants import PLANES, REGION_SIZE


class TerrainDecodeError(RuntimeError):
    pass


_HEIGHT_OPCODE = 1
_OVERLAY_MAX = 49
_SETTINGS_MAX = 81


@dataclass(slots=True, frozen=True)
class TerrainDefinition:
    """Per-tile terrain, each array shaped (plane, x, y).

    ``underlay_id`` and ``overlay_id`` are as stored - 1-based, so a definition
    lookup is ``id - 1`` and 0 means "none".
    """

    height: np.ndarray
    underlay_id: np.ndarray
    overlay_id: np.ndarray
    overlay_path: np.ndarray
    overlay_rotation: np.ndarray
    settings: np.ndarray
    bytes_consumed: int = 0


def _empty(dtype: type) -> np.ndarray:
    return np.zeros((PLANES, REGION_SIZE, REGION_SIZE), dtype=dtype)


def decode_terrain(data: bytes) -> TerrainDefinition:
    height = _empty(np.uint8)
    underlay = _empty(np.uint16)
    overlay = _empty(np.int16)
    path = _empty(np.uint8)
    rotation = _empty(np.uint8)
    settings = _empty(np.uint8)

    r = DefinitionReader(data)
    try:
        for plane in range(PLANES):
            for x in range(REGION_SIZE):
                for y in range(REGION_SIZE):
                    _decode_tile(
                        r,
                        plane,
                        x,
                        y,
                        height,
                        underlay,
                        overlay,
                        path,
                        rotation,
                        settings,
                    )
    except IndexError as exc:
        raise TerrainDecodeError("terrain stream ended early") from exc

    return TerrainDefinition(
        height=height,
        underlay_id=underlay,
        overlay_id=overlay,
        overlay_path=path,
        overlay_rotation=rotation,
        settings=settings,
        bytes_consumed=r.pos,
    )


def _decode_tile(
    r: DefinitionReader,
    plane: int,
    x: int,
    y: int,
    height: np.ndarray,
    underlay: np.ndarray,
    overlay: np.ndarray,
    path: np.ndarray,
    rotation: np.ndarray,
    settings: np.ndarray,
) -> None:
    while True:
        attribute = r.u2()
        if attribute == 0:
            return
        if attribute == _HEIGHT_OPCODE:
            height[plane, x, y] = r.u1()
            return
        if attribute <= _OVERLAY_MAX:
            overlay[plane, x, y] = r.s2()
            path[plane, x, y] = (attribute - 2) // 4
            rotation[plane, x, y] = (attribute - 2) & 3
        elif attribute <= _SETTINGS_MAX:
            settings[plane, x, y] = attribute - _OVERLAY_MAX
        else:
            underlay[plane, x, y] = attribute - _SETTINGS_MAX
