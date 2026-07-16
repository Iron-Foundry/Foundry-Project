"""Decoder tests against real bytes captured from cache build 2620.

The fixtures are Lumbridge (region 12850 = 50 << 8 | 50), the busiest well-known
map square, plus one underlay, overlay and texture definition.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.definitions.area import decode_area
from app.definitions.object import decode_object
from app.definitions.overlay import decode_overlay
from app.definitions.texture import decode_texture
from app.definitions.underlay import decode_underlay
from app.maps.constants import (
    PLANES,
    REGION_SIZE,
    region_base,
    region_coords,
    region_id,
)
from app.maps.locations import decode_locations
from app.maps.packing import PACKED_SIZE, pack_terrain, unpack_terrain
from app.maps.terrain import decode_terrain

FIXTURES = Path(__file__).parent / "fixtures"

TERRAIN = (FIXTURES / "map_terrain_12850.bin").read_bytes()
LOCATIONS = (FIXTURES / "map_locations_12850.bin").read_bytes()

LUMBRIDGE = 12850


def test_region_id_round_trips() -> None:
    assert region_id(50, 50) == LUMBRIDGE
    assert region_coords(LUMBRIDGE) == (50, 50)
    assert region_base(LUMBRIDGE) == (3200, 3200)


def test_terrain_decodes_every_tile() -> None:
    terrain = decode_terrain(TERRAIN)

    assert terrain.height.shape == (PLANES, REGION_SIZE, REGION_SIZE)
    assert terrain.underlay_id.any()
    assert terrain.overlay_id.any()


def test_terrain_consumes_the_whole_file_bar_the_trailer() -> None:
    """2932 of the 2934 regions leave exactly one unread trailing byte.

    This is the test that catches a wrong opcode width: decoding with the pre-2022
    single-byte attribute instead of the post-209 u2 desyncs the stream, and the
    consumed count diverges wildly from the file length.
    """
    terrain = decode_terrain(TERRAIN)

    assert terrain.bytes_consumed == len(TERRAIN) - 1


def test_locations_decode_exactly() -> None:
    locations = decode_locations(LOCATIONS)

    assert len(locations) == 4726
    assert {loc.plane for loc in locations} == {0, 1, 2, 3}
    assert min(loc.object_id for loc in locations) == 85
    assert max(loc.object_id for loc in locations) == 57681
    assert all(0 <= loc.local_x < REGION_SIZE for loc in locations)
    assert all(0 <= loc.local_y < REGION_SIZE for loc in locations)
    assert all(0 <= loc.orientation <= 3 for loc in locations)


def test_terrain_packs_and_unpacks_losslessly() -> None:
    terrain = decode_terrain(TERRAIN)
    packed = pack_terrain(terrain, plane=0)

    assert len(packed) == PACKED_SIZE

    restored = unpack_terrain(packed)
    assert (restored["underlay_id"] == terrain.underlay_id[0]).all()
    assert (restored["overlay_id"] == terrain.overlay_id[0]).all()
    assert (restored["overlay_path"] == terrain.overlay_path[0]).all()
    assert (restored["overlay_rotation"] == terrain.overlay_rotation[0]).all()
    assert (restored["height"] == terrain.height[0]).all()
    assert (restored["settings"] == terrain.settings[0]).all()


def test_unpack_rejects_a_wrong_sized_blob() -> None:
    from app.maps.packing import TerrainUnpackError

    with pytest.raises(TerrainUnpackError):
        unpack_terrain(b"\x00" * 16)


def test_underlay_decodes() -> None:
    underlay = decode_underlay(1, (FIXTURES / "underlay_1.bin").read_bytes())
    assert underlay.id == 1
    assert underlay.rgb > 0


def test_overlay_decodes() -> None:
    overlay = decode_overlay(1, (FIXTURES / "overlay_1.bin").read_bytes())
    assert overlay.id == 1
    assert overlay.hide_underlay is True


def test_texture_carries_its_average_colour() -> None:
    """missing_color is the texture's average, packed as 16-bit HSL - it is what lets a
    textured overlay be coloured without decoding the texture image."""
    texture = decode_texture(1, (FIXTURES / "texture_1.bin").read_bytes())
    assert texture.id == 1
    assert 0 < texture.missing_color <= 0xFFFF


def test_area_label_decodes() -> None:
    """Area 88 is Varrock: a named label with no sprite of its own."""
    area = decode_area(88, (FIXTURES / "area_88.bin").read_bytes())
    assert area.id == 88
    assert area.name == "Varrock"
    assert area.sprite_id == -1


def test_area_icon_decodes() -> None:
    """Area 0 carries a sprite - the marker drawn where its objects are placed."""
    area = decode_area(0, (FIXTURES / "area_0.bin").read_bytes())
    assert area.id == 0
    assert area.sprite_id >= 0


def test_object_captures_its_map_area_link() -> None:
    """Opcode 82 ties an object to the area whose icon marks it on the map. It used to
    be read and discarded; keeping it is what makes map icons placeable."""
    object_with_area = decode_object(2733, (FIXTURES / "object_2733.bin").read_bytes())
    assert object_with_area.map_area_id is not None
