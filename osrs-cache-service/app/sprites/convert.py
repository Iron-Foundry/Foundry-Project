"""Converts decoded SpriteFrame RGBA buffers into standard PNG/WebP files."""

from __future__ import annotations

import io

from PIL import Image

from app.sprites.decoder import SpriteFrame


def to_png(frame: SpriteFrame) -> bytes:
    return _encode(frame, "PNG")


def to_webp(frame: SpriteFrame) -> bytes:
    return _encode(frame, "WEBP", lossless=True)


def _encode(frame: SpriteFrame, fmt: str, **save_kwargs: object) -> bytes:
    image = Image.frombytes("RGBA", (frame.width, frame.height), frame.rgba)
    buf = io.BytesIO()
    image.save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()
