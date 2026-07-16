"""Decodes the worldmap "compositemap" (archive 19, group 1) into placed elements.

Ported from RuneLite's ``WorldMapCompositeLoader`` + ``WorldMapDataLoader`` +
``WorldMapCompositeDefinition.calculateWorldOffset``. Each file in the group is a
map section: a run of map-square mappings, a run of finer zone mappings, then the
elements. An element's stored position is in the composited *display* space; the
square/zone tables shift it back to real world coordinates.

This build is past revision 425, so the map-square/zone records carry no trailing
group/file ids (the ``rev238`` branch) - verified by decoding: labels land on the
right cities (Lumbridge 3239,3234; Varrock 3211,3450).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader

WORLDMAP_ARCHIVE = 19
DETAILS_GROUP = 0
COMPOSITEMAP_GROUP = 1

_SQUARE = 64
_ZONE = 8


@dataclass(slots=True, frozen=True)
class WorldMapElement:
    area_id: int
    world_x: int
    world_y: int
    plane: int


@dataclass(slots=True, frozen=True)
class WorldMapSection:
    file_id: int
    safe_name: str
    name: str
    world_x: int
    world_y: int
    plane: int
    is_surface: bool
    default_zoom: int


def _unpack(packed: int) -> tuple[int, int, int]:
    return (packed >> 14) & 0x3FFF, packed & 0x3FFF, packed >> 28


def decode_details(files: dict[int, bytes]) -> list[WorldMapSection]:
    """The worldmap section definitions (details group): one per selectable map.

    Only the header is needed for a section list - name, anchor position, surface
    flag, default zoom. The trailing display<->world chunk mappings are skipped.
    """
    sections: list[WorldMapSection] = []
    for file_id, data in files.items():
        r = DefinitionReader(data)
        safe_name = r.jstring()
        name = r.jstring()
        x, y, plane = _unpack(r.u4())
        r.u4()  # empty tile colour
        r.u4()  # background colour
        r.u1()  # unused
        is_surface = r.u1() == 1
        default_zoom = r.u1()
        sections.append(
            WorldMapSection(
                file_id, safe_name, name, x, y, plane, is_surface, default_zoom
            )
        )
    return sections


def decode_section(data: bytes) -> list[WorldMapElement]:
    r = DefinitionReader(data)

    squares: dict[tuple[int, int], tuple[int, int]] = {}
    for _ in range(r.u2()):
        r.u1()  # data type (0)
        r.u1()  # min level
        r.u1()  # levels
        source_x, source_z = r.u2(), r.u2()
        display_x, display_z = r.u2(), r.u2()
        squares[(display_x, display_z)] = (source_x - display_x, source_z - display_z)

    zones: dict[tuple[int, int, int, int], tuple[int, int]] = {}
    for _ in range(r.u2()):
        r.u1()  # data type (1)
        r.u1()  # min level
        r.u1()  # levels
        source_sx, source_sz = r.u2(), r.u2()
        source_zx, source_zz = r.u1(), r.u1()
        display_sx, display_sz = r.u2(), r.u2()
        display_zx, display_zz = r.u1(), r.u1()
        zones[(display_sx, display_sz, display_zx, display_zz)] = (
            (source_sx - display_sx) * _SQUARE + (source_zx - display_zx) * _ZONE,
            (source_sz - display_sz) * _SQUARE + (source_zz - display_zz) * _ZONE,
        )

    elements: list[WorldMapElement] = []
    for _ in range(r.u2()):
        area_id = r.big_smart2()
        dx, dy, plane = _unpack(r.u4())
        r.u1()  # members flag
        shift = zones.get(
            (dx // _SQUARE, dy // _SQUARE, (dx & 63) // _ZONE, (dy & 63) // _ZONE)
        )
        if shift is None:
            square = squares.get((dx // _SQUARE, dy // _SQUARE))
            if square is None:
                continue
            shift = (square[0] * _SQUARE, square[1] * _SQUARE)
        elements.append(WorldMapElement(area_id, dx + shift[0], dy + shift[1], plane))
    return elements


def decode_composite(files: dict[int, bytes]) -> list[WorldMapElement]:
    """All placed elements across every section of the compositemap group."""
    elements: list[WorldMapElement] = []
    for data in files.values():
        elements.extend(decode_section(data))
    return elements
