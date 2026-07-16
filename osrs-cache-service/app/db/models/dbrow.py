from __future__ import annotations

from sqlalchemy import Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class DBRow(Base):
    __tablename__ = "dbrows"
    __table_args__ = (UniqueConstraint("cache_build_id", "dbrow_id", name="uq_dbrow"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    dbrow_id: Mapped[int] = mapped_column(Integer, nullable=False)
    table_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    columns: Mapped[dict] = mapped_column(JSONB, nullable=False)
