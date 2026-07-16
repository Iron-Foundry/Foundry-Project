from __future__ import annotations

from sqlalchemy import Boolean, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class VarPlayer(Base):
    __tablename__ = "varplayers"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "varp_id", name="uq_varplayer"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    varp_id: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[int | None] = mapped_column(Integer, nullable=True)


class VarClient(Base):
    __tablename__ = "varclients"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "varc_id", name="uq_varclient"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    varc_id: Mapped[int] = mapped_column(Integer, nullable=False)
    persist: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class VarClientString(Base):
    __tablename__ = "varclientstrings"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "varc_id", name="uq_varclientstring"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    varc_id: Mapped[int] = mapped_column(Integer, nullable=False)
    persist: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
