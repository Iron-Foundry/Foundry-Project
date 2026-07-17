"""Downloads the latest OSRS cache build and ingests it: raw groups always, typed
definitions via the decoder registry when possible. Retains only the current build -
the previous build's rows are deleted once the new build has fully ingested.
"""

from __future__ import annotations

import asyncio
import hashlib
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import SPRITE_ARCHIVE
from app.db.models import CacheBuildRecord, RawGroup
from app.js5.store import Js5Store
from app.openrs2.client import OpenRS2Client
from app.openrs2.models import CacheEntry
from app.services.ingest_dbtable_index import ingest_dbtable_index
from app.services.ingest_definitions import ingest_definitions
from app.services.ingest_gamevals import ingest_gamevals
from app.services.ingest_icons import ingest_icons
from app.services.ingest_map_tiles import ingest_map_tiles
from app.services.ingest_maps import ingest_maps
from app.services.ingest_worldmap import ingest_worldmap
from app.services.ingest_sprites import ingest_sprite_group
from app.services.retention import (
    get_current_build,
    purge_superseded_dirs,
    purge_superseded_rows,
    remove_build_dirs,
)


async def sync_once(session_factory: async_sessionmaker[AsyncSession]) -> bool:
    """Check OpenRS2 for a newer live OSRS build and ingest it if found.

    Returns True if a new build was ingested, False if already up to date.
    """
    client = OpenRS2Client()
    caches = await client.list_caches()
    latest = client.latest_live_osrs(caches)
    if latest is None:
        logger.warning("No live OSRS cache build found on OpenRS2")
        return False

    async with session_factory() as session:
        current = await get_current_build(session)
        if current is not None and current.openrs2_cache_id == latest.id:
            logger.info("Cache build {} already ingested, nothing to do", latest.id)
            return False

    with tempfile.TemporaryDirectory(prefix="osrs-cache-") as tmp:
        tmp_path = Path(tmp)
        disk_zip = tmp_path / "disk.zip"
        await client.download_disk_zip(latest, disk_zip)
        cache_dir = _extract(disk_zip, tmp_path)
        disk_zip.unlink(missing_ok=True)
        await _ingest_build(session_factory, latest, cache_dir)
    return True


def _extract(disk_zip: Path, dest: Path) -> Path:
    with zipfile.ZipFile(disk_zip) as zf:
        zf.extractall(dest)
    for candidate in dest.rglob("main_file_cache.dat2"):
        return candidate.parent
    raise FileNotFoundError("disk.zip did not contain main_file_cache.dat2")


async def _ingest_build(
    session_factory: async_sessionmaker[AsyncSession],
    cache: CacheEntry,
    cache_dir: Path,
) -> None:
    async with session_factory() as session:
        build = CacheBuildRecord(
            openrs2_cache_id=cache.id,
            game_build_major=cache.builds[0].major if cache.builds else 0,
            game_build_minor=cache.builds[0].minor if cache.builds else None,
            cache_timestamp=cache.timestamp or datetime.now(UTC),
            ingested_at=datetime.now(UTC),
            status="ingesting",
            is_current=False,
        )
        session.add(build)
        await session.flush()
        build_id = build.id

        try:
            dat2 = cache_dir / "main_file_cache.dat2"
            idx_paths = {
                int(p.suffix[4:]): p
                for p in cache_dir.glob("main_file_cache.idx*")
                if p.suffix[4:].isdigit()
            }
            with Js5Store(dat2, idx_paths) as store:
                count = 0
                for archive in store.archives():
                    for entry in store.groups(archive):
                        raw = store.read(archive, entry.group)
                        session.add(
                            RawGroup(
                                cache_build_id=build_id,
                                archive=archive,
                                group_id=entry.group,
                                size=entry.size,
                                sha256=hashlib.sha256(raw).hexdigest(),
                                data=raw,
                            )
                        )
                        if archive == SPRITE_ARCHIVE:
                            ingest_sprite_group(session, build_id, entry.group, raw)
                        count += 1
                        if count % 5000 == 0:
                            await session.flush()
                logger.info(
                    "Ingested {} raw groups for cache build {}", count, cache.id
                )
                await session.flush()

                await ingest_definitions(session, build_id, store)
                await session.flush()
                await ingest_gamevals(session, build_id, store)
                await ingest_dbtable_index(session, build_id, store)
                await session.flush()
                await ingest_icons(session, build_id, store)
                await ingest_maps(session, build_id, store)
                await session.flush()
                await ingest_worldmap(session, build_id, store)
                await session.flush()
                await ingest_map_tiles(session, build_id, store)

            build.status = "complete"
            build.is_current = True
            await purge_superseded_rows(session, build_id)
            await session.commit()
        except BaseException:
            await session.rollback()
            await asyncio.to_thread(remove_build_dirs, build_id)
            raise

        await asyncio.to_thread(purge_superseded_dirs, build_id)
        logger.info("Cache build {} is now current", cache.id)
