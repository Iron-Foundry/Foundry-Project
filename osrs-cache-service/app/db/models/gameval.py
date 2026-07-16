from __future__ import annotations

from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class GameVal(Base):
    __tablename__ = "gamevals"
    __table_args__ = (
        UniqueConstraint(
            "cache_build_id", "namespace", "entry_id", "sub_id", name="uq_gameval"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    namespace: Mapped[str] = mapped_column(String, nullable=False, index=True)
    entry_id: Mapped[int] = mapped_column(Integer, nullable=False)
    sub_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
