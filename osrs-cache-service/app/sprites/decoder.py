"""Decodes the OSRS sprite archive's group format into indexed pixel data + palette.

Port of RuneLite's ``net.runelite.cache.definitions.loaders.SpriteLoader``. A sprite
group can bundle multiple frames (e.g. animated icons); each frame decodes to its own
RGBA pixel buffer sized to the group's canvas (width x height), with the frame's own
sub-region placed at its recorded offset.
"""

from __future__ import annotations

from dataclasses import dataclass


class SpriteDecodeError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class SpriteFrame:
    frame_index: int
    width: int
    height: int
    rgba: bytes  # width * height * 4 bytes, row-major


def decode_sprites(data: bytes) -> list[SpriteFrame]:
    if len(data) < 2:
        raise SpriteDecodeError("sprite group too short")

    count = int.from_bytes(data[-2:], "big")
    if count == 0:
        return []

    header_offset = len(data) - 7 - count * 8
    if header_offset < 0:
        raise SpriteDecodeError("sprite group header out of range")

    canvas_width = int.from_bytes(data[header_offset : header_offset + 2], "big")
    canvas_height = int.from_bytes(data[header_offset + 2 : header_offset + 4], "big")
    palette_length = data[header_offset + 4] + 1

    dims_offset = header_offset + 5
    x_offsets = _read_shorts(data, dims_offset, count)
    y_offsets = _read_shorts(data, dims_offset + count * 2, count)
    widths = _read_shorts(data, dims_offset + count * 4, count)
    heights = _read_shorts(data, dims_offset + count * 6, count)

    palette_offset = header_offset - (palette_length - 1) * 3
    if palette_offset < 0:
        raise SpriteDecodeError("sprite palette out of range")
    palette = [0] + [
        int.from_bytes(data[palette_offset + i * 3 : palette_offset + i * 3 + 3], "big")
        for i in range(palette_length - 1)
    ]

    frames: list[SpriteFrame] = []
    cursor = 0
    for i in range(count):
        width, height = widths[i], heights[i]
        offset_x, offset_y = x_offsets[i], y_offsets[i]
        pixel_count = width * height
        flags = data[cursor]
        cursor += 1
        has_alpha = bool(flags & 0x2)
        row_major = bool(flags & 0x1)

        indices = bytearray(pixel_count)
        if row_major:
            for x in range(width):
                for y in range(height):
                    indices[y * width + x] = data[cursor]
                    cursor += 1
        else:
            for i2 in range(pixel_count):
                indices[i2] = data[cursor]
                cursor += 1

        alphas = bytearray([255] * pixel_count)
        if has_alpha:
            if row_major:
                for x in range(width):
                    for y in range(height):
                        alphas[y * width + x] = data[cursor]
                        cursor += 1
            else:
                for i2 in range(pixel_count):
                    alphas[i2] = data[cursor]
                    cursor += 1
        else:
            for i2 in range(pixel_count):
                if indices[i2] == 0:
                    alphas[i2] = 0

        canvas = bytearray(canvas_width * canvas_height * 4)
        for y in range(height):
            for x in range(width):
                idx = indices[y * width + x]
                rgb = palette[idx]
                dst = ((y + offset_y) * canvas_width + (x + offset_x)) * 4
                if dst < 0 or dst + 4 > len(canvas):
                    continue
                canvas[dst] = (rgb >> 16) & 0xFF
                canvas[dst + 1] = (rgb >> 8) & 0xFF
                canvas[dst + 2] = rgb & 0xFF
                canvas[dst + 3] = alphas[y * width + x]

        frames.append(
            SpriteFrame(
                frame_index=i,
                width=canvas_width,
                height=canvas_height,
                rgba=bytes(canvas),
            )
        )

    return frames


def _read_shorts(data: bytes, offset: int, count: int) -> list[int]:
    return [
        int.from_bytes(data[offset + i * 2 : offset + i * 2 + 2], "big")
        for i in range(count)
    ]
