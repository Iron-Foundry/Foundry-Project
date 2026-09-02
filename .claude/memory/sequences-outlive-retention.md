---
name: sequences-outlive-retention
description: Single-build retention does not bound a sequence - osrs-cache-service exhausted map_locations' int4 serial in production
metadata:
  type: project
---

`osrs-cache-service` keeps exactly one cache build, so no table holds more than one
build's rows. That says nothing about its **sequence**. A Postgres sequence is not
transactional and never rewinds: deleting the rows does not give the ids back, and a
rolled-back ingest spends its whole allocation too. `map_locations` takes ~5M values
per ingest and reached
`nextval: reached maximum value of sequence "map_locations_id_seq" (2147483647)`
on 2026-09-02, which broke every subsequent ingest rather than just that one.
Migration `0022` widened the column and the sequence to bigint.

**Why:** the row count looks safe and hides a lifetime counter. It also means a
repeatedly-failing ingest burns through the range *faster* than a working one, so
the symptom arrives during an outage rather than during normal growth.

**How to apply:** size a primary key against ingests x rows-per-ingest over the
service's life, not against the rows retained. Anything above ~1M rows per pass is
BIGINT (`raw_groups` and `map_locations` today; guarded by
`tests/test_model_schema.py`). Widening the column is not enough - `ALTER COLUMN
... TYPE bigint` leaves the sequence declared `AS integer`, so it must be retyped
too. Related: [[osrs-cache-migrations-manual]].
