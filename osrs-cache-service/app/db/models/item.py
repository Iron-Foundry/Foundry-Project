from __future__ import annotations

from sqlalchemy import JSON, Boolean, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (UniqueConstraint("cache_build_id", "item_id", name="uq_item"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    item_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    examine: Mapped[str] = mapped_column(Text, nullable=False, default="")
    stackable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    members: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tradeable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    noted_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    noted_template: Mapped[int | None] = mapped_column(Integer, nullable=True)
    placeholder_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    placeholder_template: Mapped[int | None] = mapped_column(Integer, nullable=True)
    team_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    inventory_model: Mapped[int | None] = mapped_column(Integer, nullable=True)
    zoom2d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    xan2d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    yan2d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    zan2d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    x_offset2d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    y_offset2d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resize_x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resize_y: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resize_z: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ambient: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    contrast: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    color_find: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    color_replace: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    texture_find: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    texture_replace: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)

    @property
    def icon_url(self) -> str | None:
        return (
            f"/item-icons/{self.item_id}" if self.inventory_model is not None else None
        )
