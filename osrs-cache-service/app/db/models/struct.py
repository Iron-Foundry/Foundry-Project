from __future__ import annotations

from sqlalchemy import Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Struct(Base):
    __tablename__ = "structs"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "struct_id", name="uq_struct"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    struct_id: Mapped[int] = mapped_column(Integer, nullable=False)
    params: Mapped[dict[str, int | str]] = mapped_column(JSONB, nullable=False)
