"""Builds the render palette for a cache build from its stored floor definitions.

Underlays and overlays are already decoded into tables by the definition ingest;
texture average-colours are read straight from the texture archive. The palette is
identical for every tile, so it is built once and shared across the render workers.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Overlay, Underlay
from app.definitions.overlay import OverlayDefinition
from app.definitions.texture import TEXTURE_ARCHIVE, TEXTURE_GROUP, decode_texture
from app.definitions.underlay import UnderlayDefinition
from app.js5.container import decompress
from app.js5.multifile import split_files
from app.js5.refindex import parse_reference_index
from app.js5.store import Js5Store
from app.maps.render.palette import FloorPalette, build_palette


async def build_render_palette(
    session: AsyncSession, cache_build_id: int, store: Js5Store
) -> FloorPalette:
    underlay_rows = (
        (
            await session.execute(
                select(Underlay).where(Underlay.cache_build_id == cache_build_id)
            )
        )
        .scalars()
        .all()
    )
    overlay_rows = (
        (
            await session.execute(
                select(Overlay).where(Overlay.cache_build_id == cache_build_id)
            )
        )
        .scalars()
        .all()
    )

    underlays = [UnderlayDefinition(id=r.underlay_id, rgb=r.rgb) for r in underlay_rows]
    overlays = [
        OverlayDefinition(
            id=r.overlay_id,
            rgb=r.rgb,
            texture=r.texture,
            hide_underlay=r.hide_underlay,
            secondary_rgb=r.secondary_rgb,
        )
        for r in overlay_rows
    ]

    return build_palette(underlays, overlays, _texture_colors(store))


def _texture_colors(store: Js5Store) -> dict[int, int]:
    try:
        ref = {
            g.group_id: g
            for g in parse_reference_index(
                decompress(store.read(255, TEXTURE_ARCHIVE)).data
            )
        }
        raw = decompress(store.read(TEXTURE_ARCHIVE, TEXTURE_GROUP)).data
        files = split_files(raw, ref[TEXTURE_GROUP].file_ids)
    except Exception:
        return {}
    return {i: decode_texture(i, b).missing_color for i, b in files.items()}
