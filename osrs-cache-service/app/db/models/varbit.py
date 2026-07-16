from __future__ import annotations

from sqlalchemy import Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Varbit(Base):
    __tablename__ = "varbits"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "varbit_id", name="uq_varbit"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    varbit_id: Mapped[int] = mapped_column(Integer, nullable=False)
    varp_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    least_significant_bit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    most_significant_bit: Mapped[int | None] = mapped_column(Integer, nullable=True)
