"""Background poll loop: checks OpenRS2 for a newer live OSRS build and ingests
it when found. Mirrors api-backend's WomNameChangeService start()/stop() lifecycle.
"""

from __future__ import annotations

import asyncio
import contextlib

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import CACHE_SYNC_INTERVAL_HOURS
from app.services.ingest import sync_once


class CacheSyncService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory
        self._task: asyncio.Task[None] | None = None

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def start(self) -> None:
        self._task = asyncio.create_task(self._poll_loop(), name="osrs-cache-sync")
        logger.info(
            "CacheSyncService started (interval={}h)", CACHE_SYNC_INTERVAL_HOURS
        )

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        logger.info("CacheSyncService stopped")

    async def _poll_loop(self) -> None:
        while True:
            try:
                ingested = await sync_once(self._session_factory)
                if not ingested:
                    logger.info("No new OSRS cache build to ingest")
            except Exception as exc:
                logger.warning("CacheSyncService sync error: {}", exc)
            await asyncio.sleep(CACHE_SYNC_INTERVAL_HOURS * 3600)
