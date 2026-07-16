"""Writes converted sprite frames to the sprites volume and returns their paths."""

from __future__ import annotations

from pathlib import Path

from app.config import SPRITES_DIR
from app.sprites.convert import to_png, to_webp
from app.sprites.decoder import SpriteFrame


def export_frame(
    sprite_id: int, frame: SpriteFrame, cache_build_id: int, base_dir: str = SPRITES_DIR
) -> tuple[str, str]:
    """Writes a frame's PNG and WebP files under base_dir/<build>/<sprite_id>_<frame>.*

    Returns (png_path, webp_path) as paths relative to base_dir.
    """
    build_dir = Path(base_dir) / str(cache_build_id)
    build_dir.mkdir(parents=True, exist_ok=True)

    stem = f"{sprite_id}_{frame.frame_index}"
    png_path = build_dir / f"{stem}.png"
    webp_path = build_dir / f"{stem}.webp"
    png_path.write_bytes(to_png(frame))
    webp_path.write_bytes(to_webp(frame))

    return (
        f"{cache_build_id}/{stem}.png",
        f"{cache_build_id}/{stem}.webp",
    )
