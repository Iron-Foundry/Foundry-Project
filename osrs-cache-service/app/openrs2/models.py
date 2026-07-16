"""Pydantic models for OpenRS2 Archive API responses."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class CacheBuild(BaseModel):
    major: int
    minor: int | None = None


class CacheEntry(BaseModel):
    id: int
    scope: str
    game: str
    environment: str
    language: str
    builds: list[CacheBuild]
    timestamp: datetime | None
    sources: list[str]
    valid_indexes: int
    indexes: int
    valid_groups: int
    groups: int
    valid_keys: int
    keys: int
    size: int
    blocks: int
    disk_store_valid: bool


class XteaKey(BaseModel):
    archive: int
    group: int
    name_hash: int
    name: str | None = None
    mapsquare: int | None = None
    key: list[int]
