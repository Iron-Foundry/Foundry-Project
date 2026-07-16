from __future__ import annotations

from sqlalchemy import Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class DBTableIndex(Base):
    __tablename__ = "dbtable_indexes"
    __table_args__ = (
        UniqueConstraint(
            "cache_build_id", "table_id", "column_id", name="uq_dbtable_index"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    table_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    column_id: Mapped[int] = mapped_column(Integer, nullable=False)
    tuples: Mapped[list] = mapped_column(JSONB, nullable=False)
