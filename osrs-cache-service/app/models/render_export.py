"""Writes on-demand item render WebP files to the renders volume.

Separate from app/models/export.py (the fixed-512 ingest-time icon) because
these files carry an expiry and live in their own directory/build-id layout -
see app/services/render_cache.py for the DB-row + file lifecycle.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from app.config import RENDERS_DIR


def export_render(
    item_id: int,
    size: int,
    canvas: bytes,
    cache_build_id: int,
    base_dir: str = RENDERS_DIR,
) -> str:
    """Writes base_dir/<build>/<item_id>_<size>.webp, returns the path relative
    to base_dir."""
    build_dir = Path(base_dir) / str(cache_build_id)
    build_dir.mkdir(parents=True, exist_ok=True)

    webp_path = build_dir / f"{item_id}_{size}.webp"
    image = Image.frombytes("RGBA", (size, size), canvas)
    image.save(webp_path, format="WEBP", lossless=True, method=0, exact=False)

    return f"{cache_build_id}/{item_id}_{size}.webp"


def delete_render(relative_path: str, base_dir: str = RENDERS_DIR) -> None:
    file_path = Path(base_dir) / relative_path
    file_path.unlink(missing_ok=True)
