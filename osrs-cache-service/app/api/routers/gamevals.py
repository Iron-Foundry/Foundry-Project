from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import GameValOut
from app.db.models import GameVal

router = APIRouter(prefix="/gamevals", tags=["gamevals"])


@router.get("")
async def list_gamevals(
    session: SessionDep,
    build_id: CurrentBuildDep,
    namespace: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[GameValOut]:
    stmt = select(GameVal).where(GameVal.cache_build_id == build_id)
    if namespace:
        stmt = stmt.where(GameVal.namespace == namespace)
    if search:
        stmt = stmt.where(GameVal.name.ilike(f"%{search}%"))
    stmt = (
        stmt.order_by(GameVal.namespace, GameVal.entry_id, GameVal.sub_id)
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return [GameValOut.model_validate(row) for row in result.scalars().all()]


@router.get("/{namespace}/{entry_id}")
async def get_gameval(
    namespace: Annotated[str, Path()],
    entry_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> list[GameValOut]:
    result = await session.execute(
        select(GameVal)
        .where(
            GameVal.cache_build_id == build_id,
            GameVal.namespace == namespace,
            GameVal.entry_id == entry_id,
        )
        .order_by(GameVal.sub_id)
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="Gameval not found")
    return [GameValOut.model_validate(row) for row in rows]
