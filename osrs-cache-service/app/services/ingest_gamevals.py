"""Ingests gameval symbol names (archive 24): each namespace group's files resolve
an entity id to its internal Jagex name, the human-readable id map.

A per-file decode failure never aborts ingestion - raw_groups preserves the whole
group's bytes regardless.
"""

from __future__ import annotations

import asyncio

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import GameVal
from app.definitions.gameval import GAMEVAL_ARCHIVE, NAMESPACES, decode_gameval
from app.js5.container import decompress
from app.js5.multifile import split_files
from app.js5.refindex import parse_reference_index
from app.js5.store import Js5Store

_YIELD_EVERY = 500


async def ingest_gamevals(
    session: AsyncSession, cache_build_id: int, store: Js5Store
) -> None:
    if GAMEVAL_ARCHIVE not in store.archives():
        logger.info("No gameval archive in build {}", cache_build_id)
        return

    ref = parse_reference_index(decompress(store.read(255, GAMEVAL_ARCHIVE)).data)

    ok = 0
    failed = 0
    for i, group in enumerate(ref):
        if i % _YIELD_EVERY == 0:
            await asyncio.sleep(0)
        namespace = NAMESPACES.get(group.group_id, str(group.group_id))
        files = split_files(
            decompress(store.read(GAMEVAL_ARCHIVE, group.group_id)).data, group.file_ids
        )
        for entry_id, file_data in files.items():
            try:
                entries = decode_gameval(group.group_id, entry_id, file_data)
            except Exception as exc:
                failed += 1
                if failed <= 3:
                    logger.warning(
                        "Failed to decode gameval {}/{}: {}", namespace, entry_id, exc
                    )
                continue
            ok += len(entries)
            session.add_all(
                GameVal(
                    cache_build_id=cache_build_id,
                    namespace=namespace,
                    entry_id=e.entry_id,
                    sub_id=e.sub_id,
                    name=e.name,
                )
                for e in entries
            )

    logger.info("Decoded gamevals: {} ok, {} failed", ok, failed)
