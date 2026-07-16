from __future__ import annotations

from sqlalchemy import Boolean, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class MapSection(Base):
    """A selectable worldmap section (archive 19 "details"): the whole surface
    plus each self-contained sub-map (dungeons, islands, undergrounds).

    ``world_x``/``world_y`` are the anchor the in-game map opens at; ``safe_name``
    is the machine id (e.g. "godwars") and ``name`` the display label.
    """

    __tablename__ = "map_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    file_id: Mapped[int] = mapped_column(Integer, nullable=False)
    safe_name: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    world_x: Mapped[int] = mapped_column(Integer, nullable=False)
    world_y: Mapped[int] = mapped_column(Integer, nullable=False)
    plane: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_surface: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_zoom: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
