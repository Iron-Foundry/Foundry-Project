from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import DBRowOut
from app.db.models import DBRow

router = APIRouter(prefix="/dbrows", tags=["dbrows"])


@router.get("")
async def list_dbrows(
    session: SessionDep,
    build_id: CurrentBuildDep,
    table_id: Annotated[int | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[DBRowOut]:
    stmt = select(DBRow).where(DBRow.cache_build_id == build_id)
    if table_id is not None:
        stmt = stmt.where(DBRow.table_id == table_id)
    stmt = stmt.order_by(DBRow.dbrow_id).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return [DBRowOut.model_validate(row) for row in result.scalars().all()]


@router.get("/{dbrow_id}")
async def get_dbrow(
    dbrow_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> DBRowOut:
    result = await session.execute(
        select(DBRow).where(
            DBRow.cache_build_id == build_id, DBRow.dbrow_id == dbrow_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="DBRow not found")
    return DBRowOut.model_validate(row)
