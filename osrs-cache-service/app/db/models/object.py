from __future__ import annotations

from sqlalchemy import Boolean, Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Object(Base):
    __tablename__ = "objects"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "object_id", name="uq_object"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    object_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    size_x: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    size_y: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    animation_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category: Mapped[int | None] = mapped_column(Integer, nullable=True)
    interactive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    map_area_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    wall_or_door: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    map_scene_id: Mapped[int] = mapped_column(Integer, nullable=False, default=-1)
    offset_y: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
