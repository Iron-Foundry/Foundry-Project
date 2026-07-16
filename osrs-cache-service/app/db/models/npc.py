from __future__ import annotations

from sqlalchemy import Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Npc(Base):
    __tablename__ = "npcs"
    __table_args__ = (UniqueConstraint("cache_build_id", "npc_id", name="uq_npc"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    npc_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    combat_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category: Mapped[int | None] = mapped_column(Integer, nullable=True)
    interactable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    minimap_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
