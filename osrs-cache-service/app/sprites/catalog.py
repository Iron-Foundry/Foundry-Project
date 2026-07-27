"""Static sprite id -> (name, category) lookup, ported from RuneLite's
``net.runelite.api.gameval.SpriteID`` (deobfuscated Jagex sprite names).

Not derivable from the cache itself - the JS5 sprite archive stores only pixel
data, no names. This is a point-in-time snapshot; if a future cache build
introduces sprite ids RuneLite hasn't named yet, those sprites simply have no
name/category (falls back to raw id display). Re-generate by re-parsing an
updated ``SpriteID.java`` if RuneLite adds coverage.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DATA_PATH = Path(__file__).parent / "data" / "sprite_names.json"


@lru_cache(maxsize=1)
def _catalog() -> dict[int, tuple[str | None, str | None]]:
    raw: dict[str, list[str | None]] = json.loads(
        _DATA_PATH.read_text(encoding="utf-8")
    )
    return {int(k): (v[0], v[1]) for k, v in raw.items()}


def lookup(sprite_id: int) -> tuple[str | None, str | None]:
    return _catalog().get(sprite_id, (None, None))
