"""Best-effort typed-definition decode, run once per registered config group.

A per-definition decode failure never aborts ingestion - raw_groups already
preserves the whole group's bytes regardless, so a handful of bad definitions
(e.g. from an opcode this decoder doesn't know yet) just skip their typed row.

Decoding is pure CPU-bound Python with no natural `await` points. Run under a
single gunicorn worker (see Dockerfile), a long uninterrupted stretch of this
starves the event loop - gunicorn's own heartbeat to the arbiter can't run,
so it looks hung and gets SIGKILLed past --timeout. `asyncio.sleep(0)` every
`_YIELD_EVERY` definitions hands control back periodically without meaningfully
slowing ingestion.
"""

from __future__ import annotations

import asyncio

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.definitions.registry import CONFIG_ARCHIVE, REGISTRY
from app.js5.container import decompress
from app.js5.multifile import split_files
from app.js5.refindex import parse_reference_index
from app.js5.store import Js5Store

_YIELD_EVERY = 500


async def ingest_definitions(
    session: AsyncSession, cache_build_id: int, store: Js5Store
) -> None:
    ref_raw = store.read(255, CONFIG_ARCHIVE)
    ref_groups = {
        g.group_id: g for g in parse_reference_index(decompress(ref_raw).data)
    }

    for definition_type in REGISTRY.values():
        ref = ref_groups.get(definition_type.group_id)
        if ref is None:
            logger.warning(
                "Config group {} not found in reference index, skipping",
                definition_type.group_id,
            )
            continue

        raw = store.read(CONFIG_ARCHIVE, definition_type.group_id)
        data = decompress(raw).data
        files = split_files(data, ref.file_ids)

        ok = 0
        failed = 0
        for i, (definition_id, file_data) in enumerate(files.items()):
            if i % _YIELD_EVERY == 0:
                await asyncio.sleep(0)
            try:
                decoded = definition_type.decode(definition_id, file_data)
            except Exception as exc:
                failed += 1
                if failed <= 3:
                    logger.warning(
                        "Failed to decode {} {}: {}",
                        definition_type.model.__tablename__,
                        definition_id,
                        exc,
                    )
                continue
            ok += 1
            row = definition_type.to_row(cache_build_id, decoded)
            session.add(definition_type.model(**row))

        logger.info(
            "Decoded {}: {} ok, {} failed",
            definition_type.model.__tablename__,
            ok,
            failed,
        )
