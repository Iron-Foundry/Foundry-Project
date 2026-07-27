"""Ingests the worldmap: section definitions (details group) and placed labels
(compositemap elements resolved to their AREA def for name, colour and sprite).

Only named elements become labels - those are the map's text labels (cities,
dungeons, landmarks). Unnamed elements are icon-only decorations already covered
by the object-location icon layer.
"""

from __future__ import annotations

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Area, MapLabel, MapSection
from app.js5.container import decompress
from app.js5.multifile import split_files
from app.js5.refindex import GroupRef, parse_reference_index
from app.js5.store import Js5Store
from app.maps.worldmap import (
    COMPOSITEMAP_GROUP,
    DETAILS_GROUP,
    WORLDMAP_ARCHIVE,
    decode_composite,
    decode_details,
)


def _group_files(
    store: Js5Store, ref: dict[int, GroupRef], group: int
) -> dict[int, bytes]:
    return split_files(
        decompress(store.read(WORLDMAP_ARCHIVE, group)).data, ref[group].file_ids
    )


async def ingest_worldmap(
    session: AsyncSession, cache_build_id: int, store: Js5Store
) -> None:
    ref = {
        g.group_id: g
        for g in parse_reference_index(
            decompress(store.read(255, WORLDMAP_ARCHIVE)).data
        )
    }
    if COMPOSITEMAP_GROUP not in ref:
        logger.info("No worldmap data in build {}", cache_build_id)
        return

    if DETAILS_GROUP in ref:
        sections = decode_details(_group_files(store, ref, DETAILS_GROUP))
        session.add_all(
            MapSection(
                cache_build_id=cache_build_id,
                file_id=s.file_id,
                safe_name=s.safe_name,
                name=s.name,
                world_x=s.world_x,
                world_y=s.world_y,
                plane=s.plane,
                is_surface=s.is_surface,
                default_zoom=s.default_zoom,
            )
            for s in sections
        )
        logger.info(
            "Ingested {} worldmap sections for build {}", len(sections), cache_build_id
        )

    elements = decode_composite(_group_files(store, ref, COMPOSITEMAP_GROUP))

    areas = {
        a.area_id: a
        for a in (
            await session.execute(
                select(Area).where(Area.cache_build_id == cache_build_id)
            )
        ).scalars()
    }

    labels = [
        MapLabel(
            cache_build_id=cache_build_id,
            area_id=element.area_id,
            name=area.name,
            text_color=area.text_color,
            sprite_id=area.sprite_id,
            plane=element.plane,
            world_x=element.world_x,
            world_y=element.world_y,
        )
        for element in elements
        if (area := areas.get(element.area_id)) is not None and area.name
    ]
    session.add_all(labels)
    logger.info("Ingested {} worldmap labels for build {}", len(labels), cache_build_id)
