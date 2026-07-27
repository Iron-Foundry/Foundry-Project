"""Maps a config archive's group id to its decoder + DB model + row builder.

Adding a new definition type later is additive: a decoder module, a DB model,
a migration, and one entry here - no changes needed to ingest.py itself.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.db.models import (
    Area,
    DBRow,
    DBTable,
    EnumDef,
    Item,
    Npc,
    Object,
    Overlay,
    Struct,
    Underlay,
    Varbit,
    VarClient,
    VarClientString,
    VarPlayer,
)
from app.definitions.area import decode_area
from app.definitions.dbrow import decode_dbrow
from app.definitions.dbtable import decode_dbtable
from app.definitions.enum_def import decode_enum
from app.definitions.item import decode_item
from app.definitions.npc import decode_npc
from app.definitions.object import decode_object
from app.definitions.overlay import decode_overlay
from app.definitions.struct import decode_struct
from app.definitions.underlay import decode_underlay
from app.definitions.varbit import decode_varbit
from app.definitions.variables import (
    decode_varclient,
    decode_varclientstring,
    decode_varplayer,
)

CONFIG_ARCHIVE = 2


@dataclass(frozen=True, slots=True)
class DefinitionType:
    group_id: int
    decode: Callable[[int, bytes], Any]
    model: type
    to_row: Callable[[int, Any], dict[str, Any]]


def _item_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "item_id": d.id,
        "name": d.name,
        "examine": d.examine,
        "stackable": d.stackable,
        "value": d.value,
        "members": d.members,
        "tradeable": d.tradeable,
        "noted_id": d.noted_id,
        "noted_template": d.noted_template,
        "placeholder_id": d.placeholder_id,
        "placeholder_template": d.placeholder_template,
        "team_id": d.team_id,
        "weight": d.weight,
        "inventory_model": d.inventory_model,
        "zoom2d": d.zoom2d,
        "xan2d": d.xan2d,
        "yan2d": d.yan2d,
        "zan2d": d.zan2d,
        "x_offset2d": d.x_offset2d,
        "y_offset2d": d.y_offset2d,
        "resize_x": d.resize_x,
        "resize_y": d.resize_y,
        "resize_z": d.resize_z,
        "ambient": d.ambient,
        "contrast": d.contrast,
        "color_find": d.color_find,
        "color_replace": d.color_replace,
        "texture_find": d.texture_find,
        "texture_replace": d.texture_replace,
    }


def _npc_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "npc_id": d.id,
        "name": d.name,
        "combat_level": d.combat_level,
        "size": d.size,
        "category": d.category,
        "interactable": d.interactable,
        "minimap_visible": d.minimap_visible,
    }


def _object_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "object_id": d.id,
        "name": d.name,
        "size_x": d.size_x,
        "size_y": d.size_y,
        "animation_id": d.animation_id,
        "category": d.category,
        "interactive": d.interactive,
        "map_area_id": d.map_area_id,
        "wall_or_door": d.wall_or_door,
        "map_scene_id": d.map_scene_id,
        "offset_y": d.offset_y,
    }


def _varbit_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "varbit_id": d.id,
        "varp_index": d.varp_index,
        "least_significant_bit": d.least_significant_bit,
        "most_significant_bit": d.most_significant_bit,
    }


def _underlay_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "underlay_id": d.id,
        "rgb": d.rgb,
    }


def _overlay_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "overlay_id": d.id,
        "rgb": d.rgb,
        "texture": d.texture,
        "hide_underlay": d.hide_underlay,
        "secondary_rgb": d.secondary_rgb,
    }


def _area_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "area_id": d.id,
        "sprite_id": d.sprite_id,
        "name": d.name,
        "text_color": d.text_color,
        "category": d.category,
    }


def _enum_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "enum_id": d.id,
        "key_type": d.key_type,
        "value_type": d.value_type,
        "default_int": d.default_int,
        "default_string": d.default_string,
        "entries": {str(k): v for k, v in d.entries.items()},
    }


def _struct_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "struct_id": d.id,
        "params": {str(k): v for k, v in d.params.items()},
    }


def _varplayer_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {"cache_build_id": cache_build_id, "varp_id": d.id, "type": d.type}


def _varclient_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {"cache_build_id": cache_build_id, "varc_id": d.id, "persist": d.persist}


def _dbtable_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "dbtable_id": d.id,
        "columns": {
            str(cid): {"types": col.types, "default": col.default}
            for cid, col in d.columns.items()
        },
    }


def _dbrow_row(cache_build_id: int, d: Any) -> dict[str, Any]:
    return {
        "cache_build_id": cache_build_id,
        "dbrow_id": d.id,
        "table_id": d.table_id,
        "columns": {
            str(cid): {"types": col.types, "values": col.values}
            for cid, col in d.columns.items()
        },
    }


REGISTRY: dict[int, DefinitionType] = {
    1: DefinitionType(
        group_id=1, decode=decode_underlay, model=Underlay, to_row=_underlay_row
    ),
    4: DefinitionType(
        group_id=4, decode=decode_overlay, model=Overlay, to_row=_overlay_row
    ),
    9: DefinitionType(group_id=9, decode=decode_npc, model=Npc, to_row=_npc_row),
    10: DefinitionType(group_id=10, decode=decode_item, model=Item, to_row=_item_row),
    6: DefinitionType(
        group_id=6, decode=decode_object, model=Object, to_row=_object_row
    ),
    14: DefinitionType(
        group_id=14, decode=decode_varbit, model=Varbit, to_row=_varbit_row
    ),
    35: DefinitionType(group_id=35, decode=decode_area, model=Area, to_row=_area_row),
    8: DefinitionType(group_id=8, decode=decode_enum, model=EnumDef, to_row=_enum_row),
    34: DefinitionType(
        group_id=34, decode=decode_struct, model=Struct, to_row=_struct_row
    ),
    16: DefinitionType(
        group_id=16, decode=decode_varplayer, model=VarPlayer, to_row=_varplayer_row
    ),
    19: DefinitionType(
        group_id=19, decode=decode_varclient, model=VarClient, to_row=_varclient_row
    ),
    15: DefinitionType(
        group_id=15,
        decode=decode_varclientstring,
        model=VarClientString,
        to_row=_varclient_row,
    ),
    38: DefinitionType(
        group_id=38, decode=decode_dbrow, model=DBRow, to_row=_dbrow_row
    ),
    39: DefinitionType(
        group_id=39, decode=decode_dbtable, model=DBTable, to_row=_dbtable_row
    ),
}
