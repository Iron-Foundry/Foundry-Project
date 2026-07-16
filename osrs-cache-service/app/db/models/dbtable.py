from __future__ import annotations

from sqlalchemy import Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class DBTable(Base):
    __tablename__ = "dbtables"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "dbtable_id", name="uq_dbtable"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    dbtable_id: Mapped[int] = mapped_column(Integer, nullable=False)
    columns: Mapped[dict] = mapped_column(JSONB, nullable=False)
