"""Best-effort sprite decode + export, called per-group during raw ingest.

A decode failure here never aborts ingestion - the group's raw bytes are already
preserved in raw_groups regardless, so a bad sprite group just skips its icon
export until the decoder is fixed.
"""

from __future__ import annotations

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Sprite
from app.js5.container import decompress
from app.sprites.catalog import lookup as lookup_sprite_name
from app.sprites.decoder import decode_sprites
from app.sprites.export import export_frame


def ingest_sprite_group(
    session: AsyncSession, cache_build_id: int, group_id: int, raw: bytes
) -> None:
    try:
        data = decompress(raw).data
        frames = decode_sprites(data)
    except Exception as exc:
        logger.warning("Sprite decode failed for group {}: {}", group_id, exc)
        return

    name, category = lookup_sprite_name(group_id)

    for frame in frames:
        try:
            png_path, webp_path = export_frame(group_id, frame, cache_build_id)
        except Exception as exc:
            logger.warning(
                "Sprite export failed for group {} frame {}: {}",
                group_id,
                frame.frame_index,
                exc,
            )
            continue
        session.add(
            Sprite(
                cache_build_id=cache_build_id,
                sprite_id=group_id,
                frame_index=frame.frame_index,
                width=frame.width,
                height=frame.height,
                png_path=png_path,
                webp_path=webp_path,
                name=name,
                category=category,
            )
        )
