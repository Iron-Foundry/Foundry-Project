from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import VarClientOut, VarPlayerOut
from app.db.models import VarClient, VarClientString, VarPlayer

router = APIRouter(tags=["variables"])


@router.get("/varplayers")
async def list_varplayers(
    session: SessionDep,
    build_id: CurrentBuildDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[VarPlayerOut]:
    stmt = (
        select(VarPlayer)
        .where(VarPlayer.cache_build_id == build_id)
        .order_by(VarPlayer.varp_id)
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return [VarPlayerOut.model_validate(row) for row in result.scalars().all()]


@router.get("/varplayers/{varp_id}")
async def get_varplayer(
    varp_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> VarPlayerOut:
    result = await session.execute(
        select(VarPlayer).where(
            VarPlayer.cache_build_id == build_id, VarPlayer.varp_id == varp_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Varplayer not found")
    return VarPlayerOut.model_validate(row)


def _register_varc(path: str, model: Any, label: str) -> None:
    @router.get(f"/{path}", name=f"list_{path}")
    async def list_varc(
        session: SessionDep,
        build_id: CurrentBuildDep,
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> list[VarClientOut]:
        stmt = (
            select(model)
            .where(model.cache_build_id == build_id)
            .order_by(model.varc_id)
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        return [VarClientOut.model_validate(row) for row in result.scalars().all()]

    @router.get(f"/{path}/{{varc_id}}", name=f"get_{path}")
    async def get_varc(
        varc_id: Annotated[int, Path(ge=0)],
        session: SessionDep,
        build_id: CurrentBuildDep,
    ) -> VarClientOut:
        result = await session.execute(
            select(model).where(
                model.cache_build_id == build_id, model.varc_id == varc_id
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        return VarClientOut.model_validate(row)


_register_varc("varclients", VarClient, "Varclient")
_register_varc("varclientstrings", VarClientString, "Varclientstring")
