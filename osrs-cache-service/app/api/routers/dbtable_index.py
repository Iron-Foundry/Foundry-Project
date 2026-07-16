from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import DBTableIndexOut
from app.db.models import DBTableIndex

router = APIRouter(prefix="/dbtable-indexes", tags=["dbtable-indexes"])


@router.get("")
async def list_dbtable_indexes(
    session: SessionDep,
    build_id: CurrentBuildDep,
    table_id: Annotated[int | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[DBTableIndexOut]:
    stmt = select(DBTableIndex).where(DBTableIndex.cache_build_id == build_id)
    if table_id is not None:
        stmt = stmt.where(DBTableIndex.table_id == table_id)
    stmt = (
        stmt.order_by(DBTableIndex.table_id, DBTableIndex.column_id)
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return [DBTableIndexOut.model_validate(row) for row in result.scalars().all()]


@router.get("/{table_id}/{column_id}")
async def get_dbtable_index(
    table_id: Annotated[int, Path(ge=0)],
    column_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> DBTableIndexOut:
    result = await session.execute(
        select(DBTableIndex).where(
            DBTableIndex.cache_build_id == build_id,
            DBTableIndex.table_id == table_id,
            DBTableIndex.column_id == column_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="DBTable index not found")
    return DBTableIndexOut.model_validate(row)
