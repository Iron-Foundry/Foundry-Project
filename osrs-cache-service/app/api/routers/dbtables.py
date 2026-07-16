from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import DBTableOut
from app.db.models import DBTable

router = APIRouter(prefix="/dbtables", tags=["dbtables"])


@router.get("")
async def list_dbtables(
    session: SessionDep,
    build_id: CurrentBuildDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[DBTableOut]:
    stmt = (
        select(DBTable)
        .where(DBTable.cache_build_id == build_id)
        .order_by(DBTable.dbtable_id)
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return [DBTableOut.model_validate(row) for row in result.scalars().all()]


@router.get("/{dbtable_id}")
async def get_dbtable(
    dbtable_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> DBTableOut:
    result = await session.execute(
        select(DBTable).where(
            DBTable.cache_build_id == build_id, DBTable.dbtable_id == dbtable_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="DBTable not found")
    return DBTableOut.model_validate(row)
