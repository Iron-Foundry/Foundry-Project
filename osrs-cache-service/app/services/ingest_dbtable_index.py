"""Ingests dbtable indexes (archive 21): each (table, column) file is a value ->
row-id lookup that accelerates dbrow queries by column value.

A per-file decode failure never aborts ingestion - raw_groups preserves the whole
group's bytes regardless.
"""

from __future__ import annotations

import asyncio
from typing import Any

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DBTableIndex
from app.definitions.dbtable_index import (
    DBTABLE_INDEX_ARCHIVE,
    DBIndexTuple,
    decode_dbtable_index,
)
from app.js5.container import decompress
from app.js5.multifile import split_files
from app.js5.refindex import parse_reference_index
from app.js5.store import Js5Store

_YIELD_EVERY = 500


def _to_json(tuples: list[DBIndexTuple]) -> list[dict[str, Any]]:
    return [
        {"base_type": t.base_type, "values": {str(k): v for k, v in t.values.items()}}
        for t in tuples
    ]


async def ingest_dbtable_index(
    session: AsyncSession, cache_build_id: int, store: Js5Store
) -> None:
    if DBTABLE_INDEX_ARCHIVE not in store.archives():
        logger.info("No dbtable index archive in build {}", cache_build_id)
        return

    ref = parse_reference_index(decompress(store.read(255, DBTABLE_INDEX_ARCHIVE)).data)

    ok = 0
    failed = 0
    for i, group in enumerate(ref):
        if i % _YIELD_EVERY == 0:
            await asyncio.sleep(0)
        files = split_files(
            decompress(store.read(DBTABLE_INDEX_ARCHIVE, group.group_id)).data,
            group.file_ids,
        )
        for column_id, file_data in files.items():
            try:
                decoded = decode_dbtable_index(group.group_id, column_id, file_data)
            except Exception as exc:
                failed += 1
                if failed <= 3:
                    logger.warning(
                        "Failed to decode dbtable index {}/{}: {}",
                        group.group_id,
                        column_id,
                        exc,
                    )
                continue
            ok += 1
            session.add(
                DBTableIndex(
                    cache_build_id=cache_build_id,
                    table_id=decoded.table_id,
                    column_id=decoded.column_id,
                    tuples=_to_json(decoded.tuples),
                )
            )

    logger.info("Decoded dbtable indexes: {} ok, {} failed", ok, failed)
