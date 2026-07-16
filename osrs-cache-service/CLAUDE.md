# osrs-cache-service

FastAPI + background sync service that owns OSRS game cache data instead of
relying on third-party sources. Pulls cache builds from the OpenRS2 Archive
(https://archive.openrs2.org/), decodes the JS5 cache format, and stores both
structured definitions and raw undecoded data in a dedicated `cache-postgres`
database (separate from the monorepo's shared `postgres`).

## Single worker only

Gunicorn runs **1 worker** (see `Dockerfile`), not the 3 used by api-backend.
`CacheSyncService` starts inside `lifespan`, one instance per worker process - 3
workers would mean 3 concurrent sync loops racing to download/ingest the same
build. Do not raise worker count without moving sync-loop ownership out of
per-worker `lifespan` (e.g. leader election or a separate process) first.

## Retention

Only the **current** cache build is kept. `app/services/ingest.py` ingests a new
build fully (raw groups, sprites, typed definitions) before dropping every other
build in the same transaction. There is no multi-build history.

Retention lives in `app/services/retention.py` and is expressed as *"keep exactly
the current build"*, not *"delete the build before this one"*. That distinction is
load-bearing: ingest used to delete only its immediate predecessor, so any build
that never became current - a sync killed partway, a restart mid-ingest - left rows
and files that nothing would ever look at again. In practice this had leaked 28
stale build directories across the sprites/icons/renders volumes (4.8 GB, 616k
files, versus 977 MB actually in use). Directories are matched by *name* against
the current build id rather than by joining against the DB, which is the only way
to reclaim a build directory whose rows are already gone.

`enforce_retention` runs on startup (`lifespan`) as well as after every ingest, so a
leak that already happened is reclaimed rather than kept forever. The directory
sweep is offloaded with `asyncio.to_thread` - a large backlog is tens of seconds of
`rmtree`, and running that on the event loop stalls gunicorn's worker heartbeat long
enough to be killed as a timeout.

`ItemIconRender` (the on-demand render cache) is build-scoped too and must stay in
`_BUILD_SCOPED_MODELS`; it was missing from the old delete list, so its rows leaked
independently of the TTL sweep in `render_cleanup.py`.

## JS5 layer (`app/js5/`)

Ported from RuneLite's Java cache module and OpenRS2's Kotlin cache library,
verified field-for-field against a real live cache build (not guessed):

- `container.py` - container header + decompression (none/gzip/bzip2).
- `index.py` - `main_file_cache.idxN` flat index (size + first sector per group).
- `store.py` - sector-chasing reader over `main_file_cache.dat2`.
- `xtea.py` - XTEA block cipher for encrypted map location groups. Canonical and
  self-consistent, but **unverified against real encrypted data** - the newest
  live cache build has no active map encryption to test against, and an older
  build's keys didn't produce valid decompression despite exhaustive variant
  testing. Treat map decryption as best-effort until re-verified.
- `refindex.py` - reference index (archive 255, group N describes archive N).
  Matches OpenRS2's `Js5Index.read` exactly, including the 2-or-4-byte
  "unsigned int smart" varint scheme used when protocol >= 7.
- `multifile.py` - splits a group's bytes into individual files using the
  trailing delta-encoded length table (`Group.kt` in OpenRS2).

## Decoder registry (`app/definitions/`)

Each config archive (archive 2) group holds one "config type" (item, npc, object,
varbit, ...), and each group bundles many individual definitions as files via the
multi-file format. `registry.py` maps a group id to its decoder + DB model + row
builder. **Group ids are hardcoded per known-good values from a real cache build**
(item=10, npc=9, object=6, varbit=14) - these are stable historically but not
guaranteed across all future builds; if ingestion for a definition type suddenly
drops to zero, re-verify the group id against `app/js5/refindex.py` output.

To add a new definition type:
1. Fetch the real RuneLite loader source (`cache/.../definitions/loaders/*.java`)
   for the ground-truth opcode table - do not guess byte widths.
2. Write `app/definitions/<type>.py` following the opcode-loop pattern in
   `item.py`/`npc.py`/`object.py` - every opcode must consume the right number of
   bytes even if the field isn't persisted, or the stream desyncs.
3. Add a DB model under `app/db/models/`, a migration, and a registry entry.
4. Validate against a real downloaded cache build before trusting it (decode every
   definition in the group, check for 0 failures, spot-check known ids).

A per-definition decode failure never aborts ingestion - `raw_groups` already
preserves the whole group's bytes regardless, satisfying "don't drop anything"
even for definition types with no decoder yet.

## Sprites (`app/sprites/`)

Sprite/icon groups (archive 8) decode to indexed pixel + palette data, convert to
PNG and WebP via Pillow, and are written to the `SPRITES_DIR` volume
(`/data/sprites` in Docker) plus indexed in the `sprites` table. Item icons are
different - see "Item icons" below.

### Names and categories (`app/sprites/catalog.py`)

The JS5 sprite archive stores only pixel data - no names. `sprites.name` and
`sprites.category` are populated at ingest time from `app/sprites/data/sprite_names.json`,
a static id -> [name, category] snapshot ported from RuneLite's
`net.runelite.api.gameval.SpriteID` (deobfuscated Jagex names; `category` is the
enclosing nested class name, e.g. `Magicon`, `ClanRankIcons` - RuneLite's own grouping
of related sprite-sheet frames). Verified 100% coverage against cache build 2620
(8515/8515 distinct sprite groups named). Sprites in a future build that RuneLite
hasn't named yet just get `name`/`category` = null and fall back to raw id display -
this is expected, not a bug. To refresh coverage, re-fetch `SpriteID.java` from
RuneLite and regenerate the JSON (see git history for the one-off parser used
originally; it was not kept as a script since it's a rare, manual operation).

## Item icons (`app/models/`)

Unlike UI sprites, OSRS does **not** ship pre-baked 2D item icons in the cache.
Each item carries a "recipe" (`inventory_model`, `xan2d`/`yan2d`/`zan2d` rotation,
`resize_x/y/z`, `ambient`/`contrast` lighting overrides, `color_find`/`color_replace`
recolor table - all captured in `app/definitions/item.py`) referencing a 3D model in
archive 7, and the game client renders that model to a flat icon at runtime. This
service replicates that: `app/models/loader.py` decodes the model binary format
(ported from RuneLite's `ModelLoader.java`, both `type2`/`type3` variants - the only
two present in the live cache), `app/models/colors.py` does HSL16->RGB conversion and
per-vertex Gouraud lighting, and `app/models/rasterizer.py` (geometry prep) +
`app/models/triangle_fill.py` (numba-JIT pixel fill) rasterize a 512x512 (16x the
game's native 32x32) lossless WebP per item.

A full ~19k-item icon pass takes roughly **~1.5 minutes** (benchmarked against cache
build 2620, 4 worker processes): `ingest_icons.py` farms decode+render+encode out to a
`ProcessPoolExecutor`, `icon_worker.py` caches the expensive geometry-prep phase
per-worker-process (~58-70% hit rate - most items share a (model, resize, rotation)
key with another item), the triangle fill itself is numba-JIT'd (~14x faster than a
pure-numpy per-triangle approach at this resolution), and WebP export uses
`method=0, exact=False` (lossless still required - this is a speed/method tuning
choice, not a quality tradeoff). This used to take ~2 hours before any of that
existed; don't trust old comments/commit messages describing a slow pure-Python pass,
this is the current state. Still fine for a background sync on a day-scale interval
either way - the `asyncio.sleep(0)` yields in `ingest_icons.py`/`ingest_definitions.py`
keep the gunicorn worker responsive throughout regardless of how long the whole pass
takes, and a long-running ingest was never actually a hang even at the old ~2hr pace.

The lighting formula, HSL gamma, **camera and texture mapping** are ported from
`osrs-clansocket/clansocket-osrs-cache-extractor` (its `ClanSocketItemSpriteExtractor`
+ `GPUIconRenderer` + `ItemLighter`), the one open project that renders correct
classic-client item icons end to end. The whole pipeline was verified by dumping and
eyeballing real rendered items, not just read.

- **Auto-fit camera (NOT `zoom2d`).** The model is rotated, its rotated bounding box
  measured, and the camera pushed to `maxHalf * 32 / 0.85` (min 100) so the item fills
  the frame; a final alpha-box `_auto_center` recentres the pixels. **`zoom2d`,
  `x_offset2d`, `y_offset2d` are deliberately ignored** - the reference ignores them and
  **many items leave `zoom2d` unset (0)**, which collapsed a brief zoom2d-based camera to
  a blank icon (Bow of Faerdhinen, Limestone Brick, items 1869-1883, ...). Those fields
  stay in `prepare_geometry`'s signature only so callers don't churn.

**Hidden surfaces: back-face culling + a per-pixel z-buffer.** `prepare_geometry` drops
faces whose projected winding faces away (`_is_front_face`), like the real client, so a
model's shadowed inner faces don't poke past its outer surface (an infernal cape's dark
lining past the lava). Among the surviving front faces a z-buffer resolves overlap, with
each face's depth pulled forward by `facePriority * 13` for the classic priority order.
clansocket instead disables culling and uses dual-side lighting (front/back colour per
`gl_FrontFacing`); `colors.py` still computes both sides and `render_from_geometry`
selects via `_is_front_face`, but with culling on only the front is ever used. An even
earlier version had culling + a painter's sort and **no** z-buffer, which mis-ordered
overlapping textured faces.

**Untextured `render_type == 2` faces are skipped** (RuneLite `ItemSpriteFactory` sets
their `faceColors3 = -2`, i.e. not drawn). Missing this drew the small fishing net's
white triangles and a stray dark triangle on the infernal cape.

**Transparency.** Faces blend in two passes - opaque first (writes depth), then
semi-transparent back-to-front (depth-tested, no write), `alpha = 255 - faceAlpha`.
Missing this rendered potions' translucent glass as an opaque grey slab. `faceAlpha == -1`
is fully invisible and dropped.

Rotation order is Z(zan2d) -> X(yan2d) -> Y(xan2d) - a genuine Jagex field-naming quirk,
confirmed against the reference: the item's `xan2d` field drives the **Y**-axis stage and
`yan2d` drives the **X**-axis stage. Do not "fix" this mapping without re-checking the
reference; it looks backwards but isn't.

Textured faces are UV-mapped, not skipped. Each textured face carries a texture
triangle (P, M, N) whose camera-space positions define the texture plane; `rasterizer.py`
resolves each face vertex into that basis (`_compute_face_uv`) and
`triangle_fill.fill_triangle_textured` samples the texture with perspective-correct UVs,
modulating each texel by the face's 2..126 lightness (`texel * light / 128`, per
`method2791`). Texture images are built once per ingest from the texture archive (9,
rev233 = one sprite each) via `texture_image.py` + `services/texture_loader.py`, gamma
0.8 to 128x128 **RGBA**, and shared read-only across the render pool. The alpha channel
is load-bearing: the kernel discards texels with alpha < 128 (the client's
`texColor.a < 0.01`), because many item textures are mostly transparent - a fishing net
is holes, the magic-log texture is a ~94%-transparent sparkle overlay - and drawing
those texels opaque paints them solid black. Two knobs are calibrated by
unit test but only visually confirmable against a live render: the U/V axis orientation
(P->M vs P->N) and the 64-vs-128 texture resolution. The on-demand `/item-icons/{id}/render`
path is still untextured (it has no cache store at request time); only the baked
`item_icons` are textured. `ingest_icons.py` renders every item with a
non-null `inventory_model` (19,419/33,743 in cache build 2620 - the rest are
noted/placeholder/currency items with no visual model at all) into the `ICONS_DIR`
volume (`/data/icons` in Docker), indexed in the `item_icons` table, same
single-current-build retention as everything else.

## Maps (`app/maps/`)

Decodes archive 5 (maps) and renders a slippy-tile map, owning it instead of proxying
Explv's third-party tileset. **This cache's archive 5 is not the layout most docs
describe** (all verified by decoding the live build, not assumed):

- Archive 5 has **no group name hashes** (reference index `flags=0x04`). The group id
  *is* the region id (`region_x << 8 | region_y`); the historical `m{x}_{y}`/`l{x}_{y}`
  name lookup is gone, so `refindex.py` does not need to keep name hashes.
- Each group is 5 files: **0 = terrain, 1 = locations**, the rest metadata we ignore.
- **No XTEA.** Every group decompresses and locations decode byte-exact from plaintext;
  `app/js5/xtea.py` and `OpenRS2Client.download_keys()` stay unused.
- Terrain is the **post-209 short form** - `attribute` is a u2, overlay id an s2. The
  pre-2022 single-byte widths desync the stream immediately. `terrain.py` records
  `bytes_consumed`; 2932/2934 regions consume the file bar a 1-byte trailer.

Decoders: `terrain.py` (per-tile height/underlay/overlay/shape into `(4,64,64)` numpy),
`locations.py` (nested delta streams, using `ushort_smart`/`uint_smart_short_compat` on
`DefinitionReader`), `packing.py` (a fixed 64x64 record array per region-plane for the
`map_terrain` BYTEA - a per-tile table would be ~20x the storage for query power the
renderer never needs). Underlay (archive 2 group 1), overlay (group 4), area/map-icons
(group 35) and textures (archive 9) ride the normal definition registry.

**Renderer (`app/maps/render/`)** is a port of RuneLite's `MapImageDumper`, with the
colour maths (`JagexColor`, the underlay/overlay `calculateHsl`) taken verbatim, not
guessed. Overlay lookup is `id - 1` (RuneLite's `findOverlay(overlayId-1)`); indexing by
`id` paints every tile with the next definition's colour. `blend.py` averages each
underlay over an 11-tile window that reaches *into neighbouring regions*, so a region is
always rendered with its 8 neighbours' terrain padded around it or every region border
seams. `shapes.py` generates the 8 tile-shape masks x 4 rotations (they depend on pixel
scale, so they are generated not tabulated). Textured overlays are coloured from the
texture's stored average HSL (`missing_color`) - no texture image decode. There is no
height shading, exactly as the dumper and the OSRS Wiki map.

**Tiles.** `tiles.py` is an absolute, origin-aligned XYZ scheme: base zoom 5 = 8 px/tile
so a region is a 2x2 block of 256 px tiles, and each lower zoom halves the grid down to
zoom 0. XYZ y grows south while game y grows north - that flip lives in
`base_tiles_for_region` and nowhere else. `ingest_map_tiles.py` renders every
region-plane at base zoom on a `ProcessPoolExecutor` (same pattern as item icons),
`map_worker.py` cuts each to 256 px tiles skipping empty ones, then the pyramid is built
purely by 2x2-downsampling tiles already on disk. A full bake is ~22.6k tiles / ~100 MB
across 4 planes in ~2 min (build 2620); lossless WebP on flat map art compresses far
below the naive estimate.

`ingest_maps.py` writes `map_squares` + packed `map_terrain`, and streams the ~5M
`map_locations` rows through **asyncpg `COPY`** on the session's own connection (the ORM
cannot add 5M rows in reasonable time) - it shares the ingest transaction. Both run in
`_ingest_build` after icons. All map models are build-scoped and **must stay in
`retention._BUILD_SCOPED_MODELS`** or they leak like `ItemIconRender` once did.

**Serving.** Tiles are immutable static files served by an nginx sidecar
(`deploy/tiles.nginx.conf`, compose service `cache-tiles`) off the maps volume - the
single-worker cache app must not sit in the tile hot path. `app/api/routers/maps.py`
keeps a `FileResponse` fallback plus the low-volume data endpoints: `/map/meta` (the
manifest and per-region coverage bitmap that lets the client skip the ~81% of the
bounding box that is empty), `/map/regions/{id}`, `/map/locations` (bbox or object-id),
and `/map/icons` (the location -> object -> area join, 4043 placed icons). City *labels*
are decoded (877 named areas) but not yet placed - areas carry no polygon here, so their
placement needs the worldmap archive (18), which is not yet decoded.

## Local development

```bash
uv sync
uv run pytest        # fixtures under tests/fixtures/ are real cache group bytes,
                      # captured once from a live build - no network needed
uv run ruff check .
uv run pyright
```

Running the service needs `DATABASE_URL` pointing at a Postgres instance (see
docker-compose `cache-postgres` service) and `alembic upgrade head` applied.
