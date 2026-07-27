from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.item_variants import to_item_out, variant_base_name, variant_index
from app.api.schemas import ItemCatalogOut, ItemOut
from app.db.models import Item

router = APIRouter(prefix="/items", tags=["items"])


@router.get("")
async def list_items(
    session: SessionDep,
    build_id: CurrentBuildDep,
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ItemOut]:
    index = await variant_index(session, build_id)
    stmt = select(Item).where(Item.cache_build_id == build_id, Item.name != "")
    if search:
        stmt = stmt.where(Item.name.ilike(f"%{search}%"))
    if index.hidden_ids:
        stmt = stmt.where(Item.item_id.notin_(index.hidden_ids))
    stmt = stmt.order_by(Item.item_id).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return [to_item_out(row, index.counts) for row in result.scalars().all()]


@router.get("/names")
async def list_item_names(
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> dict[int, str]:
    result = await session.execute(
        select(Item.item_id, Item.name).where(
            Item.cache_build_id == build_id, Item.name != ""
        )
    )
    return dict(result.tuples().all())


@router.get("/catalog")
async def list_item_catalog(
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> list[ItemCatalogOut]:
    result = await session.execute(
        select(Item.item_id, Item.name, Item.members)
        .where(
            Item.cache_build_id == build_id,
            Item.name != "",
            Item.inventory_model.is_not(None),
        )
        .order_by(Item.item_id)
    )
    return [
        ItemCatalogOut(item_id=item_id, name=name, members=members)
        for item_id, name, members in result.all()
    ]


@router.get("/{item_id}")
async def get_item(
    item_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> ItemOut:
    result = await session.execute(
        select(Item).where(Item.cache_build_id == build_id, Item.item_id == item_id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    index = await variant_index(session, build_id)
    return to_item_out(item, index.counts)


@router.get("/{item_id}/variants")
async def list_item_variants(
    item_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> list[ItemOut]:
    target = await session.execute(
        select(Item).where(Item.cache_build_id == build_id, Item.item_id == item_id)
    )
    item = target.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    key = variant_base_name(item.name)
    if not key:
        return [to_item_out(item, {key: 1})]

    result = await session.execute(
        select(Item).where(Item.cache_build_id == build_id, Item.name != "")
    )
    matches = sorted(
        (row for row in result.scalars().all() if variant_base_name(row.name) == key),
        key=lambda row: row.item_id,
    )
    counts = {key: len(matches)}
    return [to_item_out(row, counts) for row in matches]
