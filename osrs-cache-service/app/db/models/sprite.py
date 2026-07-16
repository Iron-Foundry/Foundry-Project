from __future__ import annotations

from sqlalchemy import Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Sprite(Base):
    """Indexes a converted sprite/icon frame to its file on the sprites volume.

    One JS5 sprite group can contain multiple frames (e.g. animated icons); each
    frame is its own row, keyed by (cache_build_id, sprite_id, frame_index).
    """

    __tablename__ = "sprites"
    __table_args__ = (
        UniqueConstraint(
            "cache_build_id", "sprite_id", "frame_index", name="uq_sprite_frame"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    sprite_id: Mapped[int] = mapped_column(Integer, nullable=False)
    frame_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    width: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    height: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    png_path: Mapped[str] = mapped_column(String(255), nullable=False)
    webp_path: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
