# Changelog

All notable changes to osrs-cache-service are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`pyproject.toml` holds the version and is the single source of truth for it.
Bump with `uv version --bump patch|minor` (or `alpha|beta|rc` for a
prerelease, `stable` to drop the tag). A MAJOR bump is the maintainer's call
and is never made automatically.

## [0.2.1] - 2026-09-02

### Fixed

- Ingestion could no longer complete: `map_locations.id` was an int4 serial and its
  sequence hit `nextval: reached maximum value of sequence "map_locations_id_seq"
  (2147483647)`. Retention keeps one build's rows, but a sequence is not
  transactional and never rewinds - each ingest spends ~5M values whether it commits
  or rolls back, so the ceiling was a lifetime total and every ingest after it was
  going to fail, not just the one that reached it. The column and its sequence are
  now bigint. The failed run rolled back cleanly and the previously ingested build
  kept serving throughout, as designed.

## [0.2.0] - 2026-09-01

### Added

- NPC definitions keep the fields the decoder used to consume and drop: `model_ids`
  and `chathead_model_ids` (the archive 7 models the client draws), `actions` (the
  five right-click slots, `null` where the cache says `Hidden`), `color_find` /
  `color_replace` / `texture_find` / `texture_replace`, and the form table
  `varbit_id` / `varp_index` / `configs`. The form table is why a name search can
  land on a blank NPC: a shell definition transforms into whichever id its varbit or
  varp value selects, and `configs` is that lookup, its last entry the form used when
  the value is out of range.
- `GET /npcs/names` returns the whole npc id to name map in one call, mirroring
  `/items/names`. Unnamed shells are omitted.

## [0.1.0] - 2026-07-28

Versioning baseline. Stays pre-1.0 while the cache decoders and map pipeline are still settling. Adds `GET /version`, reporting the package version plus the commit and build timestamp baked into the container image.
