from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import StructOut
from app.db.models import Struct

router = APIRouter(prefix="/structs", tags=["structs"])


@router.get("")
async def list_structs(
    session: SessionDep,
    build_id: CurrentBuildDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[StructOut]:
    stmt = (
        select(Struct)
        .where(Struct.cache_build_id == build_id)
        .order_by(Struct.struct_id)
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return [StructOut.model_validate(row) for row in result.scalars().all()]


@router.get("/{struct_id}")
async def get_struct(
    struct_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> StructOut:
    result = await session.execute(
        select(Struct).where(
            Struct.cache_build_id == build_id, Struct.struct_id == struct_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Struct not found")
    return StructOut.model_validate(row)
