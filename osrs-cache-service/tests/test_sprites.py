"""Sprite decode + conversion tested against a real decompressed sprite group
(archive 8, group 0 - visually confirmed to render a clean 40x40 UI icon)."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image

from app.sprites.convert import to_png, to_webp
from app.sprites.decoder import decode_sprites

FIXTURES = Path(__file__).parent / "fixtures"


def test_decode_real_sprite_group() -> None:
    data = (FIXTURES / "sprite_group_a8_g0.bin").read_bytes()
    frames = decode_sprites(data)
    assert len(frames) == 1
    frame = frames[0]
    assert (frame.width, frame.height) == (40, 40)
    assert len(frame.rgba) == 40 * 40 * 4
    assert any(alpha > 0 for alpha in frame.rgba[3::4])


def test_convert_round_trips_through_pillow() -> None:
    data = (FIXTURES / "sprite_group_a8_g0.bin").read_bytes()
    frame = decode_sprites(data)[0]

    png_bytes = to_png(frame)
    png_image = Image.open(io.BytesIO(png_bytes))
    assert png_image.size == (frame.width, frame.height)
    assert png_image.mode == "RGBA"

    webp_bytes = to_webp(frame)
    webp_image = Image.open(io.BytesIO(webp_bytes))
    assert webp_image.size == (frame.width, frame.height)


def test_decode_empty_sprite_group() -> None:
    assert decode_sprites(b"\x00\x00") == []
