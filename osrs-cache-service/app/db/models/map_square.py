from __future__ import annotations

from sqlalchemy import Integer, LargeBinary, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class MapSquare(Base):
    """One 64x64-tile region of the world (archive 5 group).

    ``region_id`` is the archive 5 group id itself - ``region_x << 8 | region_y``.
    ``plane_mask`` has bit N set when plane N has any terrain, so the tile baker and
    the coverage manifest can skip empty planes without unpacking terrain.
    """

    __tablename__ = "map_squares"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "region_id", name="uq_map_square"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    region_id: Mapped[int] = mapped_column(Integer, nullable=False)
    region_x: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    region_y: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    plane_mask: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)


class MapTerrain(Base):
    """Packed per-tile terrain for one region-plane.

    ``data`` is a fixed 64x64 record array (see ``app/maps/packing.py``); Postgres
    TOAST-compresses it. Storing the 18.3M non-empty tiles as rows instead would cost
    roughly twenty times as much for query power the renderer does not need.
    """

    __tablename__ = "map_terrain"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "region_id", "plane", name="uq_map_terrain"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    region_id: Mapped[int] = mapped_column(Integer, nullable=False)
    plane: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
