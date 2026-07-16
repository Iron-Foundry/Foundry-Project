from __future__ import annotations

from collections.abc import AsyncGenerator
from concurrent.futures import ProcessPoolExecutor
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CacheBuildRecord


async def get_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    async with request.app.state.session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_current_build_id(session: SessionDep) -> int:
    result = await session.execute(
        select(CacheBuildRecord.id).where(CacheBuildRecord.is_current == True)  # noqa: E712
    )
    build_id = result.scalar_one_or_none()
    if build_id is None:
        raise HTTPException(
            status_code=503, detail="No cache build has been ingested yet"
        )
    return build_id


CurrentBuildDep = Annotated[int, Depends(get_current_build_id)]


def get_render_pool(request: Request) -> ProcessPoolExecutor:
    return request.app.state.render_pool


RenderPoolDep = Annotated[ProcessPoolExecutor, Depends(get_render_pool)]
