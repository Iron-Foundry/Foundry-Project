"""Lookup-or-render for on-demand, arbitrary-resolution item icons.

Rendering at up to 4096x4096 is CPU-bound the same way bulk ingest is (see
ingest_icons.py), so the actual decode+rasterize work is farmed out to a
shared ProcessPoolExecutor (app.state.render_pool, single-worker gunicorn
constraint - see osrs-cache-service/CLAUDE.md) rather than run inline, keeping
the request non-blocking for the rest of the gunicorn worker. Successful
renders are cached as a DB row + WebP file with a short expiry so repeat
requests for the same (item, size) are a pure file read.

Uses the same textured rasterizer as the baked `item_icons` bulk ingest (see
icon_worker.py) rather than a cut-down untextured path - texture images are
loaded from `raw_groups` (the DB is all this request path has; there's no live
Js5Store) via `texture_cache.get_cached_textures`, memoized per build so
rebuilding the table (a couple hundred sprite decodes) doesn't happen on every
request.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ProcessPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path as FsPath

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import MODEL_ARCHIVE, RENDER_CACHE_TTL_DAYS, RENDERS_DIR
from app.db.models import Item, ItemIconRender, RawGroup
from app.models.render_export import export_render
from app.services.render_worker import render_item_at_size
from app.services.texture_cache import get_cached_textures


class RenderNotAvailableError(RuntimeError):
    pass


async def get_or_render_item_icon(
    session: AsyncSession,
    pool: ProcessPoolExecutor,
    *,
    build_id: int,
    item_id: int,
    size: int,
) -> FsPath:
    cached = await _get_cached(session, build_id, item_id, size)
    if cached is not None:
        return cached

    item = (
        await session.execute(
            select(Item).where(Item.cache_build_id == build_id, Item.item_id == item_id)
        )
    ).scalar_one_or_none()
    if item is None or item.inventory_model is None:
        raise RenderNotAvailableError(f"item {item_id} has no inventory model")

    raw_group = (
        await session.execute(
            select(RawGroup).where(
                RawGroup.cache_build_id == build_id,
                RawGroup.archive == MODEL_ARCHIVE,
                RawGroup.group_id == item.inventory_model,
            )
        )
    ).scalar_one_or_none()
    if raw_group is None:
        raise RenderNotAvailableError(
            f"model {item.inventory_model} not found in cache build"
        )

    textures = await get_cached_textures(session, build_id)

    loop = asyncio.get_running_loop()
    canvas = await loop.run_in_executor(
        pool,
        render_item_at_size,
        raw_group.data,
        item.inventory_model,
        item.xan2d or 0,
        item.yan2d or 0,
        item.zan2d or 0,
        item.zoom2d or 0,
        item.x_offset2d or 0,
        item.y_offset2d or 0,
        item.resize_x,
        item.resize_y,
        item.resize_z,
        item.ambient,
        item.contrast,
        item.color_find,
        item.color_replace,
        size,
        textures,
    )

    relative_path = export_render(item_id, size, canvas, build_id)
    expires_at = datetime.now(UTC) + timedelta(days=RENDER_CACHE_TTL_DAYS)
    await session.execute(
        delete(ItemIconRender).where(
            ItemIconRender.cache_build_id == build_id,
            ItemIconRender.item_id == item_id,
            ItemIconRender.size == size,
        )
    )
    session.add(
        ItemIconRender(
            cache_build_id=build_id,
            item_id=item_id,
            size=size,
            webp_path=relative_path,
            expires_at=expires_at,
        )
    )
    await session.commit()
    return FsPath(RENDERS_DIR) / relative_path


async def _get_cached(
    session: AsyncSession, build_id: int, item_id: int, size: int
) -> FsPath | None:
    row = (
        await session.execute(
            select(ItemIconRender).where(
                ItemIconRender.cache_build_id == build_id,
                ItemIconRender.item_id == item_id,
                ItemIconRender.size == size,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None

    if row.expires_at <= datetime.now(UTC):
        await session.delete(row)
        await session.commit()
        return None

    file_path = FsPath(RENDERS_DIR) / row.webp_path
    if not file_path.is_file():
        await session.delete(row)
        await session.commit()
        return None

    return file_path
