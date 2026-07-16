from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ItemIconRender(Base):
    """An on-demand, arbitrary-resolution item render requested by a user.

    Separate from ItemIcon (the fixed-512 render made for every item at ingest
    time) - this is a lazily-populated cache keyed on (build, item, size), with
    a short expiry so unpopular sizes don't accumulate forever on disk. See
    app/services/render_cache.py.
    """

    __tablename__ = "item_icon_renders"
    __table_args__ = (
        UniqueConstraint(
            "cache_build_id", "item_id", "size", name="uq_item_icon_render"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    item_id: Mapped[int] = mapped_column(Integer, nullable=False)
    size: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    webp_path: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
