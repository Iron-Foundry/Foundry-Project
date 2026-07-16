from __future__ import annotations

from pathlib import Path as FsPath
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.schemas import SpriteCategoryOut, SpriteOut
from app.config import SPRITES_DIR
from app.db.models import Sprite

router = APIRouter(prefix="/sprites", tags=["sprites"])


def _to_out(sprite: Sprite) -> SpriteOut:
    return SpriteOut(
        sprite_id=sprite.sprite_id,
        frame_index=sprite.frame_index,
        width=sprite.width,
        height=sprite.height,
        png_url=f"/sprites/{sprite.sprite_id}/{sprite.frame_index}?format=png",
        webp_url=f"/sprites/{sprite.sprite_id}/{sprite.frame_index}?format=webp",
        name=sprite.name,
        category=sprite.category,
    )


@router.get("")
async def list_sprites(
    session: SessionDep,
    build_id: CurrentBuildDep,
    category: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[SpriteOut]:
    stmt = select(Sprite).where(
        Sprite.cache_build_id == build_id, Sprite.frame_index == 0
    )
    if category:
        stmt = stmt.where(Sprite.category == category)
    if search:
        stmt = stmt.where(Sprite.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Sprite.sprite_id).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return [_to_out(row) for row in result.scalars().all()]


@router.get("/categories")
async def list_sprite_categories(
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> list[SpriteCategoryOut]:
    result = await session.execute(
        select(Sprite.category, func.count())
        .where(
            Sprite.cache_build_id == build_id,
            Sprite.frame_index == 0,
            Sprite.category.is_not(None),
        )
        .group_by(Sprite.category)
        .order_by(func.count().desc())
    )
    return [SpriteCategoryOut(category=cat, count=count) for cat, count in result.all()]


@router.get("/{sprite_id}")
async def list_sprite_frames(
    sprite_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> list[SpriteOut]:
    result = await session.execute(
        select(Sprite)
        .where(Sprite.cache_build_id == build_id, Sprite.sprite_id == sprite_id)
        .order_by(Sprite.frame_index)
    )
    frames = result.scalars().all()
    if not frames:
        raise HTTPException(status_code=404, detail="Sprite not found")
    return [_to_out(f) for f in frames]


@router.get("/{sprite_id}/{frame_index}")
async def get_sprite_image(
    sprite_id: Annotated[int, Path(ge=0)],
    frame_index: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
    format: Annotated[Literal["png", "webp"], Query()] = "png",
) -> FileResponse:
    result = await session.execute(
        select(Sprite).where(
            Sprite.cache_build_id == build_id,
            Sprite.sprite_id == sprite_id,
            Sprite.frame_index == frame_index,
        )
    )
    sprite = result.scalar_one_or_none()
    if sprite is None:
        raise HTTPException(status_code=404, detail="Sprite frame not found")

    relative_path = sprite.png_path if format == "png" else sprite.webp_path
    file_path = FsPath(SPRITES_DIR) / relative_path
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Sprite file missing on disk")
    media_type = "image/png" if format == "png" else "image/webp"
    return FileResponse(file_path, media_type=media_type)
