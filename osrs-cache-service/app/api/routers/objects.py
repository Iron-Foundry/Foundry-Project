from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import ObjectOut
from app.db.models import Object

router = APIRouter(prefix="/objects", tags=["objects"])


@router.get("")
async def list_objects(
    session: SessionDep,
    build_id: CurrentBuildDep,
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ObjectOut]:
    stmt = select(Object).where(Object.cache_build_id == build_id)
    if search:
        stmt = stmt.where(Object.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Object.object_id).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return [ObjectOut.model_validate(row) for row in result.scalars().all()]


@router.get("/{object_id}")
async def get_object(
    object_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> ObjectOut:
    result = await session.execute(
        select(Object).where(
            Object.cache_build_id == build_id, Object.object_id == object_id
        )
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Object not found")
    return ObjectOut.model_validate(obj)
