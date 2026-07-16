"""Writes rendered item icon WebP files to the icons volume and returns their path."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from app.config import ICONS_DIR


def export_icon(
    item_id: int,
    canvas: bytes,
    size: int,
    cache_build_id: int,
    base_dir: str = ICONS_DIR,
) -> str:
    """Writes base_dir/<build>/<item_id>.webp, returns the path relative to base_dir."""
    build_dir = Path(base_dir) / str(cache_build_id)
    build_dir.mkdir(parents=True, exist_ok=True)

    webp_path = build_dir / f"{item_id}.webp"
    # canvas is already raw bytes from ndarray.tobytes() - frombytes() accepts
    # it directly, no need to copy through bytes()/bytearray() again.
    image = Image.frombytes("RGBA", (size, size), canvas)
    # method=0: ~5x faster than method=1 on a representative random sample
    # (encode was the dominant per-item cost per ingest perf logs), for a
    # ~2.3x file size increase - still trivial for a small web thumbnail.
    # exact=False lets the encoder ignore RGB under fully-transparent alpha
    # (most of the canvas), a free win on both size and speed.
    image.save(webp_path, format="WEBP", lossless=True, method=0, exact=False)

    return f"{cache_build_id}/{item_id}.webp"
