from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import NpcOut
from app.db.models import Npc

router = APIRouter(prefix="/npcs", tags=["npcs"])


@router.get("")
async def list_npcs(
    session: SessionDep,
    build_id: CurrentBuildDep,
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[NpcOut]:
    stmt = select(Npc).where(Npc.cache_build_id == build_id)
    if search:
        stmt = stmt.where(Npc.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Npc.npc_id).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return [NpcOut.model_validate(row) for row in result.scalars().all()]


@router.get("/names")
async def list_npc_names(
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> dict[int, str]:
    result = await session.execute(
        select(Npc.npc_id, Npc.name).where(
            Npc.cache_build_id == build_id, Npc.name != ""
        )
    )
    return dict(result.tuples().all())


@router.get("/{npc_id}")
async def get_npc(
    npc_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> NpcOut:
    result = await session.execute(
        select(Npc).where(Npc.cache_build_id == build_id, Npc.npc_id == npc_id)
    )
    npc = result.scalar_one_or_none()
    if npc is None:
        raise HTTPException(status_code=404, detail="NPC not found")
    return NpcOut.model_validate(npc)
