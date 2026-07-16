"""Best-effort 2D item icon render, run once per item that has an inventory model.

A per-item render failure never aborts ingestion - same philosophy as
ingest_sprites.py / the npc decoder. Textured-only models render with their
textured faces simply left transparent (texture decoding is out of scope for
this pass - see osrs-cache-service/CLAUDE.md), which can look incomplete for
the minority of items that are texture-heavy, but never crashes.

Rendering ~19k items is CPU-bound (model decode + rasterize) and, even with the
numpy-vectorized rasterizer, too slow for one process at 512x512. Raw model
bytes are read sequentially first (cheap - plain file I/O, seconds not
minutes), then farmed out to a `ProcessPoolExecutor` so the heavy decode+
render+encode work runs across multiple CPU cores. Awaiting the executor
futures naturally yields the event loop back to gunicorn's heartbeat for the
whole duration, so the single-worker gunicorn process never looks hung
regardless of total ingest wall time.

Jobs are sorted by geometry key (model/resize/rotation) before chunking so
items sharing a key land in nearby chunks, which a given worker process is
likely to pick up in sequence - improves the icon_worker.py geometry cache's
hit rate (that cache persists per-worker-process across chunks, not just
within one).

Progress is logged as periodic newline-terminated loguru lines rather than a
live-redrawing tqdm bar - tqdm draws by overwriting the current line with
`\r`, which never produces a real line break, so log collectors (including
`docker compose logs`) show nothing until the run ends and a real `\n`
finally appears. Plain periodic log lines use the same mechanism as every
other line in this file's logs and are guaranteed visible in real time. Each
line includes a live cache-hit-rate and per-phase timing breakdown so future
perf questions can be answered by reading the logs instead of re-benchmarking.
"""

from __future__ import annotations

import asyncio
import time
from concurrent.futures import ProcessPoolExecutor

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import MODEL_ARCHIVE
from app.db.models import Item, ItemIcon
from app.js5.store import Js5Store
from app.services.icon_worker import IconJob, render_item_icon_chunk
from app.services.texture_loader import load_textures

_CANVAS_SIZE = 512
_WORKER_PROCESSES = 4
_CHUNK_SIZE = 10
_YIELD_EVERY = 500
_PROGRESS_LOG_INTERVAL_S = 5.0


def _geometry_sort_key(
    job: IconJob,
) -> tuple[int, int, int, int, int, int, int, int, int, int]:
    return (
        job.model_id,
        job.resize_x or 128,
        job.resize_y or 128,
        job.resize_z or 128,
        job.xan2d,
        job.yan2d,
        job.zan2d,
        job.zoom2d,
        job.x_offset2d,
        job.y_offset2d,
    )


async def ingest_icons(
    session: AsyncSession, cache_build_id: int, store: Js5Store
) -> None:
    result = await session.execute(
        select(Item).where(
            Item.cache_build_id == cache_build_id, Item.inventory_model.is_not(None)
        )
    )
    items = result.scalars().all()

    jobs: list[IconJob] = []
    failed = 0
    for i, item in enumerate(items):
        if i % _YIELD_EVERY == 0:
            await asyncio.sleep(0)
        if item.inventory_model is None:
            continue
        try:
            raw = store.read(MODEL_ARCHIVE, item.inventory_model)
        except Exception as exc:
            failed += 1
            if failed <= 3:
                logger.warning(
                    "Failed to read model for item {}: {}", item.item_id, exc
                )
            continue
        jobs.append(
            IconJob(
                item_id=item.item_id,
                model_id=item.inventory_model,
                raw_model_bytes=raw,
                xan2d=item.xan2d or 0,
                yan2d=item.yan2d or 0,
                zan2d=item.zan2d or 0,
                zoom2d=item.zoom2d or 0,
                x_offset2d=item.x_offset2d or 0,
                y_offset2d=item.y_offset2d or 0,
                resize_x=item.resize_x,
                resize_y=item.resize_y,
                resize_z=item.resize_z,
                ambient=item.ambient,
                contrast=item.contrast,
                color_find=item.color_find,
                color_replace=item.color_replace,
                canvas_size=_CANVAS_SIZE,
                cache_build_id=cache_build_id,
            )
        )

    jobs.sort(key=_geometry_sort_key)
    chunks = [jobs[i : i + _CHUNK_SIZE] for i in range(0, len(jobs), _CHUNK_SIZE)]
    textures = load_textures(store)
    logger.info("Loaded {} textures for icon rendering", len(textures))

    ok = 0
    total = len(jobs)
    done = 0
    cache_hits = 0
    cache_misses = 0
    geometry_s = 0.0
    render_s = 0.0
    encode_s = 0.0
    start = time.monotonic()
    last_log = start
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor(max_workers=_WORKER_PROCESSES) as pool:
        futures = [
            loop.run_in_executor(pool, render_item_icon_chunk, chunk, textures)
            for chunk in chunks
        ]
        for coro in asyncio.as_completed(futures):
            stats = await coro
            cache_hits += stats.cache_hits
            cache_misses += stats.cache_misses
            geometry_s += stats.geometry_s
            render_s += stats.render_s
            encode_s += stats.encode_s

            for res in stats.results:
                if res.error is not None:
                    failed += 1
                    if failed <= 3:
                        logger.warning(
                            "Failed to render icon for item {}: {}",
                            res.item_id,
                            res.error,
                        )
                    continue
                ok += 1
                session.add(
                    ItemIcon(
                        cache_build_id=cache_build_id,
                        item_id=res.item_id,
                        width=res.width,
                        height=res.height,
                        webp_path=res.webp_path,
                    )
                )
            done += len(stats.results)

            now = time.monotonic()
            if now - last_log >= _PROGRESS_LOG_INTERVAL_S or done == total:
                rate = done / (now - start) if now > start else 0.0
                eta_s = (total - done) / rate if rate > 0 else 0.0
                cache_total = cache_hits + cache_misses
                hit_rate = 100 * cache_hits / cache_total if cache_total else 0.0
                logger.info(
                    "Rendering item icons: {}/{} ({:.0f}%) - {} ok, {} failed - {:.1f}/s - ETA {:.0f}s "
                    "- geometry cache {:.0f}% ({}/{}) - avg ms/item geometry={:.2f} render={:.2f} encode={:.2f}",
                    done,
                    total,
                    100 * done / total if total else 100,
                    ok,
                    failed,
                    rate,
                    eta_s,
                    hit_rate,
                    cache_hits,
                    cache_total,
                    1000 * geometry_s / max(cache_misses, 1),
                    1000 * render_s / max(done, 1),
                    1000 * encode_s / max(done, 1),
                )
                last_log = now

    logger.info("Rendered item icons: {} ok, {} failed", ok, failed)
