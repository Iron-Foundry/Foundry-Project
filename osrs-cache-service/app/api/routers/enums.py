from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import EnumOut
from app.db.models import EnumDef

router = APIRouter(prefix="/enums", tags=["enums"])


@router.get("")
async def list_enums(
    session: SessionDep,
    build_id: CurrentBuildDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[EnumOut]:
    stmt = (
        select(EnumDef)
        .where(EnumDef.cache_build_id == build_id)
        .order_by(EnumDef.enum_id)
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return [EnumOut.model_validate(row) for row in result.scalars().all()]


@router.get("/{enum_id}")
async def get_enum(
    enum_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> EnumOut:
    result = await session.execute(
        select(EnumDef).where(
            EnumDef.cache_build_id == build_id, EnumDef.enum_id == enum_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Enum not found")
    return EnumOut.model_validate(row)
