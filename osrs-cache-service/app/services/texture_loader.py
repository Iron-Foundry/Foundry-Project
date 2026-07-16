"""Builds the ``texture id -> RGB image`` table the item-icon rasterizer needs.

Enumerates the texture archive (9) the same way the map palette does, then for
each texture decodes its backing sprite (archive 8) and bakes a flat texture
image (see app/models/texture_image.py). The result is a small dict of numpy
arrays (there are only a couple hundred textures) shared read-only across every
render job, so it is built once per ingest rather than per item.
"""

from __future__ import annotations

import numpy as np
from loguru import logger

from app.config import SPRITE_ARCHIVE
from app.definitions.texture import TEXTURE_ARCHIVE, TEXTURE_GROUP, decode_texture
from app.js5.container import decompress
from app.js5.multifile import split_files
from app.js5.refindex import parse_reference_index
from app.js5.store import Js5Store
from app.models.texture_image import build_texture_image
from app.sprites.decoder import decode_sprites


def load_textures(store: Js5Store) -> dict[int, np.ndarray]:
    try:
        ref = {
            g.group_id: g
            for g in parse_reference_index(
                decompress(store.read(255, TEXTURE_ARCHIVE)).data
            )
        }
        raw = decompress(store.read(TEXTURE_ARCHIVE, TEXTURE_GROUP)).data
        files = split_files(raw, ref[TEXTURE_GROUP].file_ids)
    except Exception as exc:
        logger.warning(
            "Could not read texture archive, icons render untextured: {}", exc
        )
        return {}

    textures: dict[int, np.ndarray] = {}
    for texture_id, definition_bytes in files.items():
        try:
            sprite_id = decode_texture(texture_id, definition_bytes).sprite_id
            frames = decode_sprites(
                decompress(store.read(SPRITE_ARCHIVE, sprite_id)).data
            )
            if frames:
                textures[texture_id] = build_texture_image(frames[0])
        except Exception:
            continue
    return textures
