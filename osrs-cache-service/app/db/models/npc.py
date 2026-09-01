from __future__ import annotations

from sqlalchemy import JSON, Boolean, Integer, String, UniqueConstraint
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
    model_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    chathead_model_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    actions: Mapped[list[str | None] | None] = mapped_column(JSON, nullable=True)
    color_find: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    color_replace: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    texture_find: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    texture_replace: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    varbit_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    varp_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    configs: Mapped[list[int | None] | None] = mapped_column(JSON, nullable=True)
