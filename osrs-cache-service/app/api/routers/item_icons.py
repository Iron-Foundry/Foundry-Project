from __future__ import annotations

from pathlib import Path as FsPath
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from fastapi.responses import FileResponse
from sqlalchemy import select

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentBuildDep, RenderPoolDep, SessionDep
from app.config import ICONS_DIR, RENDER_MAX_SIZE, RENDER_MIN_SIZE
from app.db.models import Item, ItemIcon
from app.services.render_cache import RenderNotAvailableError, get_or_render_item_icon

router = APIRouter(prefix="/item-icons", tags=["item-icons"])


async def _icon_for(
    session: AsyncSession, build_id: int, item_id: int
) -> ItemIcon | None:
    result = await session.execute(
        select(ItemIcon).where(
            ItemIcon.cache_build_id == build_id, ItemIcon.item_id == item_id
        )
    )
    return result.scalar_one_or_none()


async def _resolve_icon(
    session: AsyncSession, build_id: int, item_id: int
) -> ItemIcon | None:
    icon = await _icon_for(session, build_id, item_id)
    if icon is not None:
        return icon
    item = await session.execute(
        select(Item).where(Item.cache_build_id == build_id, Item.item_id == item_id)
    )
    linked = item.scalar_one_or_none()
    if linked is None:
        return None
    base_id = linked.noted_id or linked.placeholder_id
    if not base_id:
        return None
    return await _icon_for(session, build_id, base_id)


@router.get("/{item_id}")
async def get_item_icon(
    item_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> FileResponse:
    icon = await _resolve_icon(session, build_id, item_id)
    if icon is None:
        raise HTTPException(status_code=404, detail="Item icon not found")

    file_path = FsPath(ICONS_DIR) / icon.webp_path
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Item icon file missing on disk")
    return FileResponse(
        file_path,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.get("/{item_id}/render")
async def render_item_icon(
    item_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
    pool: RenderPoolDep,
    size: Annotated[int, Query(ge=RENDER_MIN_SIZE, le=RENDER_MAX_SIZE)] = 512,
) -> FileResponse:
    try:
        file_path = await get_or_render_item_icon(
            session, pool, build_id=build_id, item_id=item_id, size=size
        )
    except RenderNotAvailableError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return FileResponse(
        file_path,
        media_type="image/webp",
        headers={"Cache-Control": "no-store"},
        filename=f"{item_id}_{size}.webp",
    )
