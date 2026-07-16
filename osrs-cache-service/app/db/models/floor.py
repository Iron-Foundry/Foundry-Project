from __future__ import annotations

from sqlalchemy import Boolean, Integer, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Underlay(Base):
    """A ground floor colour (config archive group 1)."""

    __tablename__ = "underlays"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "underlay_id", name="uq_underlay"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    underlay_id: Mapped[int] = mapped_column(Integer, nullable=False)
    rgb: Mapped[int] = mapped_column(Integer, nullable=False)


class Overlay(Base):
    """A ground detail colour drawn over an underlay (config archive group 4).

    ``rgb == 0xFF00FF`` is Jagex's "no colour" sentinel - the overlay draws nothing
    and the underlay shows through.
    """

    __tablename__ = "overlays"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "overlay_id", name="uq_overlay"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    overlay_id: Mapped[int] = mapped_column(Integer, nullable=False)
    rgb: Mapped[int] = mapped_column(Integer, nullable=False)
    texture: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=-1)
    hide_underlay: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    secondary_rgb: Mapped[int] = mapped_column(Integer, nullable=False, default=-1)
