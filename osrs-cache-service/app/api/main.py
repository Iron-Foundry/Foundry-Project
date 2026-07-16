from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI
from loguru import logger

from app.api.routers import (
    dbrows,
    dbtable_index,
    dbtables,
    enums,
    gamevals,
    item_icons,
    items,
    maps,
    meta,
    npcs,
    objects,
    sprites,
    structs,
    variables,
)
from app.config import DATABASE_URL
from app.db import create_engine, create_session_factory
from app.services.render_cleanup import RenderCleanupService
from app.services.retention import enforce_retention
from app.services.sync_service import CacheSyncService

_RENDER_POOL_WORKERS = 2


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Connecting to PostgreSQL...")
    engine = create_engine(DATABASE_URL)
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    app.state.render_pool = ProcessPoolExecutor(max_workers=_RENDER_POOL_WORKERS)

    await enforce_retention(app.state.session_factory)

    sync_service = CacheSyncService(app.state.session_factory)
    await sync_service.start()

    render_cleanup_service = RenderCleanupService(app.state.session_factory)
    await render_cleanup_service.start()

    yield

    await render_cleanup_service.stop()
    await sync_service.stop()
    app.state.render_pool.shutdown(wait=False, cancel_futures=True)
    logger.info("Closing PostgreSQL connection...")
    await engine.dispose()


app = FastAPI(title="OSRS Cache Service", lifespan=lifespan)

app.include_router(items.router)
app.include_router(item_icons.router)
app.include_router(npcs.router)
app.include_router(objects.router)
app.include_router(sprites.router)
app.include_router(maps.router)
app.include_router(meta.router)
app.include_router(enums.router)
app.include_router(structs.router)
app.include_router(variables.router)
app.include_router(dbtables.router)
app.include_router(dbrows.router)
app.include_router(dbtable_index.router)
app.include_router(gamevals.router)

app.frontend("/", directory="app/static")
