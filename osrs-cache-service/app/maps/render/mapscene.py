"""Loads the map-scene decoration sprites (trees, rocks, stairs, ...).

These live in a single named group, "mapscene", inside the sprite archive; an object's
``map_scene_id`` indexes its frames. The group is resolved by djb2 name hash (the same
scheme RuneLite's ``findArchiveByName`` uses), decoded with the normal sprite decoder,
and scaled to the render's pixels-per-tile so decorations sit at the right size.
"""

from __future__ import annotations

import numpy as np

from app.config import SPRITE_ARCHIVE
from app.js5.container import decompress
from app.js5.refindex import parse_reference_index
from app.js5.store import Js5Store
from app.sprites.decoder import decode_sprites

_MAPSCENE = "mapscene"
_BASE_SCENE_SCALE = 4


def _djb2(name: str) -> int:
    value = 0
    for char in name:
        value = (ord(char) + ((value << 5) - value)) & 0xFFFFFFFF
    return value - (1 << 32) if value >= (1 << 31) else value


def load_map_scenes(store: Js5Store, scale: int) -> list[np.ndarray]:
    """Returns map-scene frames as RGBA arrays, indexed by map_scene_id.

    Empty list if the group cannot be found or decoded - object rendering then simply
    draws no decorations rather than failing.
    """
    try:
        groups = parse_reference_index(decompress(store.read(255, SPRITE_ARCHIVE)).data)
    except Exception:
        return []

    target = _djb2(_MAPSCENE)
    group_id = next((g.group_id for g in groups if g.name_hash == target), None)
    if group_id is None:
        return []

    try:
        frames = decode_sprites(decompress(store.read(SPRITE_ARCHIVE, group_id)).data)
    except Exception:
        return []

    factor = max(1, scale // _BASE_SCENE_SCALE)
    scenes: list[np.ndarray] = []
    for frame in frames:
        image = np.frombuffer(frame.rgba, dtype=np.uint8).reshape(
            frame.height, frame.width, 4
        )
        if factor > 1:
            image = np.repeat(np.repeat(image, factor, axis=0), factor, axis=1)
        scenes.append(np.ascontiguousarray(image))
    return scenes
