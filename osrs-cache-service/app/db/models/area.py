from __future__ import annotations

from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Area(Base):
    """A map icon + label definition (config archive group 35).

    An object references an area by ``map_area_id``; that area supplies the sprite and
    name shown on the map. Positions come from where the object is placed (``MapLocation``),
    so a map icon is a join of location -> object -> area.
    """

    __tablename__ = "areas"
    __table_args__ = (UniqueConstraint("cache_build_id", "area_id", name="uq_area"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    area_id: Mapped[int] = mapped_column(Integer, nullable=False)
    sprite_id: Mapped[int] = mapped_column(Integer, nullable=False, default=-1)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    text_color: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category: Mapped[int | None] = mapped_column(Integer, nullable=True)
