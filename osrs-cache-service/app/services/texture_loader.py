"""Builds the ``texture id -> RGB image`` table the item-icon rasterizer needs.

Enumerates the texture archive (9) the same way the map palette does, then for
each texture decodes its backing sprite (archive 8) and bakes a flat texture
image (see app/models/texture_image.py). The result is a small dict of numpy
arrays (there are only a couple hundred textures) shared read-only across every
render job.

Two loaders build the same table from two different sources: `load_textures`
reads a live `Js5Store` (bulk ingest, one process, sequential reads are cheap),
`load_textures_from_db` reads `raw_groups` rows over an `AsyncSession` (on-demand
render requests, which only have DB access - see render_cache.py). The DB path
needs two round trips (definitions, then the sprite ids the definitions name)
since which sprites are needed isn't known until the texture archive is decoded.
"""

from __future__ import annotations

import numpy as np
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SPRITE_ARCHIVE
from app.db.models import RawGroup
from app.definitions.texture import TEXTURE_ARCHIVE, TEXTURE_GROUP, decode_texture
from app.js5.container import decompress
from app.js5.multifile import split_files
from app.js5.refindex import parse_reference_index
from app.js5.store import Js5Store
from app.models.texture_image import build_texture_image
from app.sprites.decoder import decode_sprites

_REFINDEX_ARCHIVE = 255


def _sprite_to_texture_image(raw_sprite_bytes: bytes) -> np.ndarray | None:
    frames = decode_sprites(decompress(raw_sprite_bytes).data)
    return build_texture_image(frames[0]) if frames else None


def load_textures(store: Js5Store) -> dict[int, np.ndarray]:
    try:
        ref = {
            g.group_id: g
            for g in parse_reference_index(
                decompress(store.read(_REFINDEX_ARCHIVE, TEXTURE_ARCHIVE)).data
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
            image = _sprite_to_texture_image(store.read(SPRITE_ARCHIVE, sprite_id))
            if image is not None:
                textures[texture_id] = image
        except Exception:
            continue
    return textures


async def load_textures_from_db(
    session: AsyncSession, build_id: int
) -> dict[int, np.ndarray]:
    result = await session.execute(
        select(RawGroup.archive, RawGroup.group_id, RawGroup.data).where(
            RawGroup.cache_build_id == build_id,
            (
                (RawGroup.archive == _REFINDEX_ARCHIVE)
                & (RawGroup.group_id == TEXTURE_ARCHIVE)
            )
            | (
                (RawGroup.archive == TEXTURE_ARCHIVE)
                & (RawGroup.group_id == TEXTURE_GROUP)
            ),
        )
    )
    rows = {(archive, group_id): data for archive, group_id, data in result.all()}
    ref_bytes = rows.get((_REFINDEX_ARCHIVE, TEXTURE_ARCHIVE))
    texture_bytes = rows.get((TEXTURE_ARCHIVE, TEXTURE_GROUP))
    if ref_bytes is None or texture_bytes is None:
        logger.warning(
            "Texture archive rows missing for build {}, icons render untextured",
            build_id,
        )
        return {}

    try:
        ref = {g.group_id: g for g in parse_reference_index(decompress(ref_bytes).data)}
        files = split_files(decompress(texture_bytes).data, ref[TEXTURE_GROUP].file_ids)
    except Exception as exc:
        logger.warning(
            "Could not parse texture archive for build {}: {}", build_id, exc
        )
        return {}

    sprite_ids: dict[int, int] = {}
    for texture_id, definition_bytes in files.items():
        try:
            sprite_ids[texture_id] = decode_texture(
                texture_id, definition_bytes
            ).sprite_id
        except Exception:
            continue
    if not sprite_ids:
        return {}

    result = await session.execute(
        select(RawGroup.group_id, RawGroup.data).where(
            RawGroup.cache_build_id == build_id,
            RawGroup.archive == SPRITE_ARCHIVE,
            RawGroup.group_id.in_(set(sprite_ids.values())),
        )
    )
    sprite_bytes = {group_id: data for group_id, data in result.all()}

    textures: dict[int, np.ndarray] = {}
    for texture_id, sprite_id in sprite_ids.items():
        raw = sprite_bytes.get(sprite_id)
        if raw is None:
            continue
        try:
            image = _sprite_to_texture_image(raw)
            if image is not None:
                textures[texture_id] = image
        except Exception:
            continue
    return textures
