"""Process-local memo of the texture table for the current build.

Split out of render_cache.py to keep that file under the file-size limit.
Only one build is ever current, so keying by build id and clearing on a miss
is enough to self-invalidate across ingests without a TTL.
"""

from __future__ import annotations

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.texture_loader import load_textures_from_db

_texture_cache: dict[int, dict[int, np.ndarray]] = {}


async def get_cached_textures(
    session: AsyncSession, build_id: int
) -> dict[int, np.ndarray]:
    if build_id not in _texture_cache:
        _texture_cache.clear()
        _texture_cache[build_id] = await load_textures_from_db(session, build_id)
    return _texture_cache[build_id]
