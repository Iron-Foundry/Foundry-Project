from __future__ import annotations

from sqlalchemy import BigInteger, Index, Integer, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class MapLocation(Base):
    """A single placed object ("loc") in the world - ~5M rows per cache build.

    World coordinates are denormalised from (region, local) at ingest so a bbox
    query needs no arithmetic on the index. Rows are written with asyncpg's COPY,
    not the ORM; at this volume ``session.add()`` is not viable.

    ``id`` must stay BIGINT. Retention keeps one build's rows, but the sequence is
    not transactional and never rewinds: every ingest consumes ~5M values whether
    it commits or rolls back, so an int4 sequence is a countdown to a permanent
    ingest failure - one this table reached in production.
    """

    __tablename__ = "map_locations"
    __table_args__ = (
        Index("ix_map_location_object", "cache_build_id", "object_id"),
        Index(
            "ix_map_location_position", "cache_build_id", "plane", "world_x", "world_y"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False)
    region_id: Mapped[int] = mapped_column(Integer, nullable=False)
    object_id: Mapped[int] = mapped_column(Integer, nullable=False)
    plane: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    world_x: Mapped[int] = mapped_column(Integer, nullable=False)
    world_y: Mapped[int] = mapped_column(Integer, nullable=False)
    shape: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    orientation: Mapped[int] = mapped_column(SmallInteger, nullable=False)
