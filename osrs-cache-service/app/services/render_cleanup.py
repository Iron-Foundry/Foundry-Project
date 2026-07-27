"""Periodic sweep of expired on-demand item renders (see render_cache.py).

Lookups also lazily delete an individual expired row on access, but that only
covers sizes someone actually re-requests - a size nobody asks for again would
otherwise keep its row and file forever. This walks the whole table on an
interval instead.
"""

from __future__ import annotations

import asyncio
import contextlib
from datetime import UTC, datetime

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models import ItemIconRender
from app.models.render_export import delete_render

_SWEEP_INTERVAL_HOURS = 6.0


class RenderCleanupService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory
        self._task: asyncio.Task[None] | None = None

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def start(self) -> None:
        self._task = asyncio.create_task(
            self._sweep_loop(), name="render-cache-cleanup"
        )
        logger.info(
            "RenderCleanupService started (interval={}h)", _SWEEP_INTERVAL_HOURS
        )

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        logger.info("RenderCleanupService stopped")

    async def _sweep_loop(self) -> None:
        while True:
            try:
                removed = await self._sweep_once()
                if removed:
                    logger.info(
                        "RenderCleanupService removed {} expired render(s)", removed
                    )
            except Exception as exc:
                logger.warning("RenderCleanupService sweep error: {}", exc)
            await asyncio.sleep(_SWEEP_INTERVAL_HOURS * 3600)

    async def _sweep_once(self) -> int:
        async with self._session_factory() as session:
            now = datetime.now(UTC)
            expired = (
                (
                    await session.execute(
                        select(ItemIconRender).where(ItemIconRender.expires_at <= now)
                    )
                )
                .scalars()
                .all()
            )
            for row in expired:
                delete_render(row.webp_path)
                await session.delete(row)
            await session.commit()
            return len(expired)
