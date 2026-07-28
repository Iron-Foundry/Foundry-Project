from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.api.dependencies import SessionDep
from app.api.schemas import MetaOut, VersionOut
from app.db.models import CacheBuildRecord, Item, Npc, Object, Sprite
from app.version import VERSION

router = APIRouter(tags=["meta"])


@router.get("/meta")
async def get_meta(session: SessionDep) -> MetaOut:
    result = await session.execute(
        select(CacheBuildRecord).where(CacheBuildRecord.is_current == True)  # noqa: E712
    )
    build = result.scalar_one_or_none()
    if build is None:
        raise HTTPException(
            status_code=503, detail="No cache build has been ingested yet"
        )

    async def count(model: type) -> int:
        r = await session.execute(
            select(func.count())
            .select_from(model)
            .where(model.cache_build_id == build.id)
        )
        return r.scalar_one()

    return MetaOut(
        cache_build_id=build.id,
        openrs2_cache_id=build.openrs2_cache_id,
        game_build_major=build.game_build_major,
        game_build_minor=build.game_build_minor,
        item_count=await count(Item),
        npc_count=await count(Npc),
        object_count=await count(Object),
        sprite_count=await count(Sprite),
    )


@router.get("/version")
async def get_version() -> VersionOut:
    """Identify the deployed build.

    `version` comes from the package manifest. `git_sha` and `build_time` are
    injected as container build arguments and are `null` for a local run
    outside Docker.
    """
    return VersionOut(
        service="osrs-cache-service",
        version=VERSION,
        git_sha=os.getenv("GIT_SHA") or None,
        build_time=os.getenv("BUILD_TIME") or None,
    )


@router.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok"}
