"""Decodes an OSRS texture definition - texture archive (9), group 0.

Ported from RuneLite's ``TextureLoader.java`` (the ``rev233`` branch, which is what
the current live cache uses).

Only ``missing_color`` matters to the map renderer. Despite the name it is the
texture's *average* colour, packed as a 16-bit HSL - RuneLite's
``RSTextureProvider.getAverageTextureRGB`` returns exactly this field. That means a
textured overlay can be coloured without decoding a single texture image.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.definitions.base import DefinitionReader

TEXTURE_ARCHIVE = 9
TEXTURE_GROUP = 0


@dataclass(slots=True)
class TextureDefinition:
    id: int
    sprite_id: int
    missing_color: int
    animation_direction: int = 0
    animation_speed: int = 0


def decode_texture(texture_id: int, data: bytes) -> TextureDefinition:
    r = DefinitionReader(data)
    sprite_id = r.u2()
    missing_color = r.u2()
    r.u1()
    animation_direction = r.u1()
    animation_speed = r.u1()

    return TextureDefinition(
        id=texture_id,
        sprite_id=sprite_id,
        missing_color=missing_color,
        animation_direction=animation_direction,
        animation_speed=animation_speed,
    )
