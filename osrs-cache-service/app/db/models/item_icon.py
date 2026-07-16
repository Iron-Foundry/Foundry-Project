from __future__ import annotations

from sqlalchemy import Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ItemIcon(Base):
    """A rendered 2D inventory icon for an item, indexed to its WebP file on the icons volume.

    Rendered from the item's model + icon recipe (zoom/rotation/offset/recolor) at
    ingest time - see app/services/ingest_icons.py. Not every item has one: items
    with no inventory_model, or whose model uses a texture on every face, are
    skipped (best-effort, same as npc/sprite decode failures elsewhere).
    """

    __tablename__ = "item_icons"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "item_id", name="uq_item_icon"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    item_id: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    height: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    webp_path: Mapped[str] = mapped_column(String(255), nullable=False)
