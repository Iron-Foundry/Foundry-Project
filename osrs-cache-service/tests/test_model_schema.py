"""Column widths that a single ingest can exhaust.

Retention keeps one build, so these tables never hold more than one build's rows -
but their sequences are not transactional and never rewind. Every ingest spends its
allocation whether it commits or rolls back, so the ceiling that matters is the
lifetime total, not the row count. `map_locations` reached the int4 ceiling in
production and every ingest after it failed.
"""

from __future__ import annotations

from sqlalchemy import BigInteger

from app.db.models import MapLocation, RawGroup

_ROWS_PER_INGEST_OVER_A_MILLION = (RawGroup, MapLocation)


def test_high_volume_tables_use_bigint_primary_keys() -> None:
    for model in _ROWS_PER_INGEST_OVER_A_MILLION:
        column = model.__table__.c.id
        assert isinstance(column.type, BigInteger), (
            f"{model.__tablename__}.id is {column.type}; an int4 sequence over this "
            "table is a countdown to a permanent ingest failure"
        )
