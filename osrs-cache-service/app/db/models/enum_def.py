from __future__ import annotations

from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class EnumDef(Base):
    __tablename__ = "enums"
    __table_args__ = (UniqueConstraint("cache_build_id", "enum_id", name="uq_enum"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    enum_id: Mapped[int] = mapped_column(Integer, nullable=False)
    key_type: Mapped[str | None] = mapped_column(String(1), nullable=True)
    value_type: Mapped[str | None] = mapped_column(String(1), nullable=True)
    default_int: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_string: Mapped[str | None] = mapped_column(String, nullable=True)
    entries: Mapped[dict] = mapped_column(JSONB, nullable=False)
