from __future__ import annotations

from sqlalchemy import Index, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class MapLabel(Base):
    """A worldmap element placed by the compositemap (archive 19): a text label
    and/or icon anchored to a world coordinate, resolved from its AREA def.

    Text carries Jagex's own ``<br>`` line breaks; ``text_color`` is a 24-bit RGB
    (null when the AREA sets none). ``sprite_id`` is -1 for text-only labels.
    """

    __tablename__ = "map_labels"
    __table_args__ = (Index("ix_map_label_plane", "cache_build_id", "plane"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    area_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    text_color: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sprite_id: Mapped[int] = mapped_column(Integer, nullable=False, default=-1)
    plane: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    world_x: Mapped[int] = mapped_column(Integer, nullable=False)
    world_y: Mapped[int] = mapped_column(Integer, nullable=False)
