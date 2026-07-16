from __future__ import annotations

from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class CacheBuildRecord(Base):
    """Tracks the currently-ingested OpenRS2 cache build.

    Only one row is ever "current" in practice - the sync service reads the latest
    row to decide whether a newer OpenRS2 build needs ingesting, and old rows are
    pruned alongside their raw_groups/typed rows once a newer build finishes.
    """

    __tablename__ = "cache_builds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    openrs2_cache_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    game_build_major: Mapped[int] = mapped_column(Integer, nullable=False)
    game_build_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cache_timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    ingested_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ingesting")
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
