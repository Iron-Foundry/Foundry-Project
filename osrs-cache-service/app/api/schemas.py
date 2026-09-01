from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    name: str
    examine: str
    stackable: bool
    value: int
    members: bool
    tradeable: bool
    noted_id: int | None
    noted_template: int | None
    placeholder_id: int | None
    placeholder_template: int | None
    team_id: int | None
    weight: int | None
    icon_url: str | None
    variant_count: int = 1


class ItemCatalogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    name: str
    members: bool


class NpcOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    npc_id: int
    name: str
    combat_level: int | None
    size: int | None
    category: int | None
    interactable: bool
    minimap_visible: bool
    model_ids: list[int] | None
    chathead_model_ids: list[int] | None
    actions: list[str | None] | None
    color_find: list[int] | None
    color_replace: list[int] | None
    texture_find: list[int] | None
    texture_replace: list[int] | None
    varbit_id: int | None
    varp_index: int | None
    configs: list[int | None] | None


class ObjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    object_id: int
    name: str
    size_x: int
    size_y: int
    animation_id: int | None
    category: int | None
    interactive: bool


class SpriteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sprite_id: int
    frame_index: int
    width: int
    height: int
    png_url: str
    webp_url: str
    name: str | None
    category: str | None


class SpriteCategoryOut(BaseModel):
    category: str
    count: int


class MetaOut(BaseModel):
    cache_build_id: int
    openrs2_cache_id: int
    game_build_major: int
    game_build_minor: int | None
    item_count: int
    npc_count: int
    object_count: int
    sprite_count: int


class VersionOut(BaseModel):
    service: str
    version: str
    git_sha: str | None
    build_time: str | None


class EnumOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    enum_id: int
    key_type: str | None
    value_type: str | None
    default_int: int | None
    default_string: str | None
    entries: dict[str, int | str]


class StructOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    struct_id: int
    params: dict[str, int | str]


class VarPlayerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    varp_id: int
    type: int | None


class VarClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    varc_id: int
    persist: bool


class DBTableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    dbtable_id: int
    columns: dict[str, dict[str, Any]]


class DBRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    dbrow_id: int
    table_id: int | None
    columns: dict[str, dict[str, Any]]


class DBTableIndexOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    table_id: int
    column_id: int
    tuples: list[dict[str, Any]]


class GameValOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    namespace: str
    entry_id: int
    sub_id: int | None
    name: str
