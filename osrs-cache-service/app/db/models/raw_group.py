from __future__ import annotations

from sqlalchemy import BigInteger, Integer, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class RawGroup(Base):
    """Every JS5 group pulled from the current cache build, decoded or not.

    Preserves data for archive/group combinations that don't have a typed decoder
    yet, so nothing is lost while decoders are added incrementally. Rows are tagged
    with the cache build they came from; ingest.py deletes the previous build's rows
    only after the new build has been fully ingested successfully.
    """

    __tablename__ = "raw_groups"
    __table_args__ = (
        UniqueConstraint("cache_build_id", "archive", "group_id", name="uq_raw_group"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cache_build_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    archive: Mapped[int] = mapped_column(Integer, nullable=False)
    group_id: Mapped[int] = mapped_column(Integer, nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
