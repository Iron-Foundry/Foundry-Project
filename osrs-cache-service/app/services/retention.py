"""Single-build retention: anything that is not the current build is deleted.

Previously ingest only deleted the build it directly superseded. Any build that
never became current - a sync killed partway, a container restart mid-ingest -
left its rows and its files behind with nothing that would ever look at them
again, and the icons volume accumulated 13 stale build directories (~83k files)
that way. Retention is therefore expressed as "keep exactly the current build",
not "delete the one before", and it runs at startup as well as after an ingest
so a leak that already happened is reclaimed rather than kept forever.

Directories are matched by name against the current build id, not by joining
against the DB - the whole point is to catch build directories whose rows are
already gone, which a DB-driven sweep could never find.
"""

from __future__ import annotations

import asyncio
import shutil
from pathlib import Path

from loguru import logger
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import ICONS_DIR, MAPS_DIR, RENDERS_DIR, SPRITES_DIR
from app.db.models import (
    Area,
    CacheBuildRecord,
    DBRow,
    DBTable,
    DBTableIndex,
    EnumDef,
    GameVal,
    Item,
    ItemIcon,
    ItemIconRender,
    MapLabel,
    MapLocation,
    MapSection,
    MapSquare,
    MapTerrain,
    Npc,
    Object,
    Overlay,
    RawGroup,
    Sprite,
    Struct,
    Underlay,
    VarClient,
    VarClientString,
    VarPlayer,
    Varbit,
)

_BUILD_SCOPED_MODELS = (
    RawGroup,
    Sprite,
    Item,
    ItemIcon,
    ItemIconRender,
    Npc,
    Object,
    Varbit,
    Underlay,
    Overlay,
    Area,
    MapLabel,
    MapSection,
    MapSquare,
    MapTerrain,
    MapLocation,
    EnumDef,
    Struct,
    VarPlayer,
    VarClient,
    VarClientString,
    DBTable,
    DBRow,
    DBTableIndex,
    GameVal,
)


def _build_dirs() -> tuple[str, ...]:
    return (SPRITES_DIR, ICONS_DIR, RENDERS_DIR, MAPS_DIR)


async def get_current_build(session: AsyncSession) -> CacheBuildRecord | None:
    result = await session.execute(
        select(CacheBuildRecord).where(CacheBuildRecord.is_current.is_(True))
    )
    return result.scalar_one_or_none()


async def purge_superseded_rows(session: AsyncSession, current_build_id: int) -> None:
    """Deletes every build-scoped row that does not belong to the current build.

    Does not commit - the caller owns the transaction, so an ingest can make the
    new build current and drop the old one atomically.
    """
    for model in _BUILD_SCOPED_MODELS:
        await session.execute(
            delete(model).where(model.cache_build_id != current_build_id)
        )
    await session.execute(
        delete(CacheBuildRecord).where(CacheBuildRecord.id != current_build_id)
    )


def purge_superseded_dirs(current_build_id: int) -> int:
    """Removes every per-build directory on the volumes except the current build's.

    Blocking: a backlog of stale builds is hundreds of thousands of files and
    takes tens of seconds to unlink. Call it off the event loop (see
    `enforce_retention`) - running it inline stalls gunicorn's worker heartbeat
    long enough to be killed as a timeout.

    Returns the number of directories removed.
    """
    keep = str(current_build_id)
    removed = 0
    for base in _build_dirs():
        root = Path(base)
        if not root.is_dir():
            continue
        for child in root.iterdir():
            if not child.is_dir() or child.name == keep:
                continue
            shutil.rmtree(child, ignore_errors=True)
            removed += 1
            logger.info("Retention: removed stale build directory {}", child)
    return removed


async def enforce_retention(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Drops every non-current build's rows and files. Safe to call at startup.

    A no-op when no build is current yet (a first-ever ingest, or one that has
    not finished): there is nothing to keep, so nothing may be deleted.
    """
    async with session_factory() as session:
        current = await get_current_build(session)
        if current is None:
            logger.info("Retention: no current build yet, nothing to purge")
            return

        await purge_superseded_rows(session, current.id)
        await session.commit()

    removed = await asyncio.to_thread(purge_superseded_dirs, current.id)
    if removed:
        logger.info(
            "Retention: reclaimed {} stale build director{} (kept build {})",
            removed,
            "y" if removed == 1 else "ies",
            current.id,
        )
