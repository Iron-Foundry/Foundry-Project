"""Read-only map endpoints: the manifest, tile files, and the decoded map data.

Tiles are static, immutable files. In production nginx serves them straight off the
volume (the tile path is public and needs no Python); this router keeps a FileResponse
fallback so the service also works without the sidecar, and owns the low-volume data
endpoints - the manifest, region metadata, object locations, and map icons.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Path, Query
from fastapi.responses import FileResponse

from app.api.dependencies import CurrentBuildDep, SessionDep
from app.api.map_manifest import build_manifest
from app.api.map_queries import (
    fetch_icons,
    fetch_labels,
    fetch_locations,
    fetch_overview_icons,
    fetch_region,
    fetch_sections,
)
from app.config import MAPS_DIR
from app.maps.constants import MAP_OVERVIEW_PLANE
from app.maps.tiles import tile_path

router = APIRouter(prefix="/map", tags=["map"])

_IMMUTABLE = {"Cache-Control": "public, max-age=31536000, immutable"}


@router.get("/meta")
async def get_meta(session: SessionDep, build_id: CurrentBuildDep) -> dict[str, Any]:
    return await build_manifest(session, build_id)


@router.get("/{build}/{plane}/{z}/{x}/{y}.webp")
async def get_tile(
    build: Annotated[int, Path(ge=0)],
    plane: Annotated[int, Path(ge=0, le=MAP_OVERVIEW_PLANE)],
    z: Annotated[int, Path(ge=0, le=5)],
    x: Annotated[int, Path(ge=0)],
    y: Annotated[int, Path(ge=0)],
) -> FileResponse:
    path = tile_path(MAPS_DIR, build, plane, z, x, y)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Tile not found")
    return FileResponse(path, media_type="image/webp", headers=_IMMUTABLE)


@router.get("/regions/{region_id}")
async def get_region(
    region_id: Annotated[int, Path(ge=0)],
    session: SessionDep,
    build_id: CurrentBuildDep,
) -> dict[str, Any]:
    region = await fetch_region(session, build_id, region_id)
    if region is None:
        raise HTTPException(status_code=404, detail="Region not found")
    return region


@router.get("/locations")
async def get_locations(
    session: SessionDep,
    build_id: CurrentBuildDep,
    object_id: Annotated[int | None, Query(ge=0)] = None,
    plane: Annotated[int | None, Query(ge=0, le=3)] = None,
    min_x: Annotated[int | None, Query(ge=0)] = None,
    min_y: Annotated[int | None, Query(ge=0)] = None,
    max_x: Annotated[int | None, Query(ge=0)] = None,
    max_y: Annotated[int | None, Query(ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=10000)] = 1000,
) -> dict[str, Any]:
    if object_id is None and (
        min_x is None or min_y is None or max_x is None or max_y is None
    ):
        raise HTTPException(
            status_code=422,
            detail="Provide object_id, or a full bounding box (min_x, min_y, max_x, max_y)",
        )
    bbox = None
    if (
        min_x is not None
        and min_y is not None
        and max_x is not None
        and max_y is not None
    ):
        bbox = (min_x, min_y, max_x, max_y)
    return await fetch_locations(session, build_id, object_id, plane, bbox, limit)


@router.get("/icons")
async def get_icons(
    session: SessionDep,
    build_id: CurrentBuildDep,
    plane: Annotated[int | None, Query(ge=0, le=MAP_OVERVIEW_PLANE)] = None,
) -> dict[str, Any]:
    if plane == MAP_OVERVIEW_PLANE:
        return await fetch_overview_icons(session, build_id)
    return await fetch_icons(session, build_id, plane)


@router.get("/labels")
async def get_labels(
    session: SessionDep,
    build_id: CurrentBuildDep,
    plane: Annotated[int | None, Query(ge=0, le=3)] = None,
) -> dict[str, Any]:
    return await fetch_labels(session, build_id, plane)


@router.get("/sections")
async def get_sections(
    session: SessionDep, build_id: CurrentBuildDep
) -> dict[str, Any]:
    return await fetch_sections(session, build_id)
