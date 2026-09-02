"""widen map_locations.id to bigint - the int4 sequence ran out

Every ingest consumes ~5M sequence values and never gives them back: a sequence
is not transactional, so a rolled-back ingest burns its allocation too, and
retention deleting the rows does not rewind it. Production reached
`nextval: reached maximum value of sequence "map_locations_id_seq" (2147483647)`,
which fails every future ingest, not just the one that hit it.

The sequence has to be widened as well as the column. `ALTER COLUMN ... TYPE
bigint` leaves the sequence declared `AS integer`, so it would keep refusing to
advance past the int4 ceiling.

Revision ID: 0022
Revises: 0021
Create Date: 2026-09-02

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INT8_MAX = 9223372036854775807
_INT4_MAX = 2147483647

_RETYPE_SEQUENCE = """
DO $$
DECLARE seq text := pg_get_serial_sequence('map_locations', 'id');
BEGIN
    IF seq IS NOT NULL THEN
        EXECUTE format('ALTER SEQUENCE %s AS {kind} MAXVALUE {maximum}', seq);
    END IF;
END $$;
"""


def upgrade() -> None:
    op.alter_column(
        "map_locations",
        "id",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )
    op.execute(_RETYPE_SEQUENCE.format(kind="bigint", maximum=_INT8_MAX))


def downgrade() -> None:
    # Only reversible while the surviving ids still fit in int4.
    op.execute(_RETYPE_SEQUENCE.format(kind="integer", maximum=_INT4_MAX))
    op.alter_column(
        "map_locations",
        "id",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )
