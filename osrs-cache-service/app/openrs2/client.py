"""HTTP client for the OpenRS2 Archive API (https://archive.openrs2.org/)."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import httpx
from loguru import logger

from app.config import CACHE_SCOPE, OPENRS2_BASE_URL
from app.openrs2.models import CacheEntry, XteaKey


class OpenRS2Client:
    def __init__(
        self, base_url: str = OPENRS2_BASE_URL, scope: str = CACHE_SCOPE
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._scope = scope

    async def list_caches(self) -> list[CacheEntry]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self._base_url}/caches.json")
            response.raise_for_status()
            return [CacheEntry.model_validate(entry) for entry in response.json()]

    def latest_live_osrs(self, caches: list[CacheEntry]) -> CacheEntry | None:
        candidates = [
            cache
            for cache in caches
            if cache.scope == self._scope
            and cache.game == "oldschool"
            and cache.environment == "live"
            and cache.disk_store_valid
            and cache.timestamp is not None
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda cache: cache.timestamp or datetime.min)

    async def download_disk_zip(self, cache: CacheEntry, dest_path: Path) -> Path:
        url = f"{self._base_url}/caches/{self._scope}/{cache.id}/disk.zip"
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info("Downloading cache build {} from {}", cache.id, url)
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                with dest_path.open("wb") as fh:
                    async for chunk in response.aiter_bytes(chunk_size=1024 * 1024):
                        fh.write(chunk)
        logger.info("Downloaded cache build {} to {}", cache.id, dest_path)
        return dest_path

    async def download_keys(self, cache: CacheEntry) -> list[XteaKey]:
        url = f"{self._base_url}/caches/{self._scope}/{cache.id}/keys.json"
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            return [XteaKey.model_validate(entry) for entry in response.json()]
