# OSRS Map Tile Processing and Caching - Implementation Document

## Overview

The web-app renders an interactive OSRS world map from raster tiles. Instead of fetching every tile directly from `raw.githubusercontent.com/Explv/osrs_map_tiles` on each page load, all tile traffic is routed through `api-backend`, which stores tile bytes in PostgreSQL and serves them with permanent cache headers. Tiles are converted from PNG to lossless WebP on ingest, tagged with a dominant colour and a content flag, and grouped by OSRS region for targeted invalidation.

Two population paths exist:

- **Lazy proxy** - a tile requested for the first time is fetched from upstream, processed, stored, and returned in the same request.
- **Bulk sync** - a background `TileSyncService` walks zoom levels 4 through 9 (configurable) and pre-populates the cache at a rate-limited pace.

A live control and observability surface lives at `/members/config/map-tiles`: sync controls, per-region invalidation, a coverage map, and a real-time SSE event feed.

---

## Architecture

```
web-app (map renderer)
  - OsrsMap canvas          → GET {API}/tiles/{plane}/{z}/{x}/{y}   (per visible tile)
  - Coverage map + feed      → GET {API}/tiles/coverage             (grid snapshot)
                             → EventSource {API}/tiles/events       (SSE live feed)

api-backend (proxy + cache + sync)
  - serve.py    GET /tiles/{plane}/{z}/{x}/{y}   → DB hit? serve : fetch upstream, process, store, publish
  - sync.py     POST /tiles/sync                 → start TileSyncService (background task)
                POST /tiles/sync/stop            → cancel running sync
                GET  /tiles/sync/status          → running flag, cached count, live progress
                GET  /tiles/events               → SSE stream (public - EventSource cannot auth)
  - management  DELETE /tiles/                   → wipe cache
                DELETE /tiles/region/{region_id} → invalidate one OSRS region
                GET    /tiles/coverage           → cached (x, y, has_content) at a zoom

  - TileSyncService  → lifecycle + cross-worker coordination (Valkey lock)
  - TileCrawler      → ascending zoom walk, 8-concurrent, 100ms/tile, progress counters
                       └─ emits sync_started / sync_progress / sync_complete / sync_stopped
  - TileEventBus     → Valkey pub/sub fan-out (channel foundry:tile_events), heartbeat every 15s
  - tile_sync_state  → Valkey keys: lock / state / stop (shared running flag + progress)
  - tile_fetcher     → download_tile / cache_tile / tile_exists (shared by proxy + sync)
  - tile_processor   → PNG → WebP, dominant colour, content detection, region_id

PostgreSQL
  - map_tiles table (BYTEA storage, composite PK)

Valkey (multi-worker coordination)
  - foundry:tile_events  channel  → SSE fan-out across all workers
  - foundry:tile_sync:lock         → single-flight sync (one worker runs it, TTL-refreshed)
  - foundry:tile_sync:state        → running flag + progress, readable from any worker
  - foundry:tile_sync:stop         → stop request, polled by the running worker
```

---

## Coordinate System

Tiles use Explv's TMS scheme derived from the RuneLite/Leaflet layout.

| Constant | Value | Meaning |
|---|---|---|
| `MAP_WIDTH` (max zoom) | 104448 | pixel width at zoom 11 |
| `MAP_HEIGHT` (max zoom) | 364544 | pixel height at zoom 11 |
| `RS_OFFSET_X` | 960 | x pixel offset of OSRS origin |
| `RS_OFFSET_Y` | 6208 | y pixel offset of OSRS origin |
| `RS_TILE_PX` | 32 | screen pixels per game tile at zoom 11 |
| `PY_CONST` | 17600 | `MAP_HEIGHT / RS_TILE_PX + RS_OFFSET_Y` |
| `EXPLV_ZOOM_MIN` / `MAX` | 4 / 11 | supported zoom range |

Derived quantities:

- Tiles per image at a zoom: `tilesPerImage(z) = 2^(14 - z)`
- Grid dimensions at a zoom:
  - `cols = ceil(104448 / 256 / 2^(11 - z))`
  - `rows = ceil(364544 / 256 / 2^(11 - z))`
- TMS y from XYZ y: `tyXyz = 2^z - 1 - tyTms`
- Zoom from on-screen scale: `z = clamp(round(6 + log2(pixelsPerGameTile)), 4, 11)`

### Region ID

Each cached tile is tagged with the OSRS region ID of its top-left corner, enabling zoom-independent invalidation. Computed in `tile_processor.tile_region_id(tx, ty_tms, z)`:

```
tpi     = 2^(14 - z)
ty_xyz  = 2^z - 1 - ty_tms
osrs_x  = tx * tpi + RS_OFFSET_X
osrs_y  = PY_CONST - ty_xyz * tpi
region  = ((osrs_x // 64) << 8) | (osrs_y // 64)      # 16-bit, 0..65535
```

Returns `None` for `z < 6`, where a single tile spans too many regions to be meaningful.

---

## Tile Processing Pipeline

`app/services/tile_processor.py` - pure functions, invoked on every ingest (both lazy and sync).

1. Decode raw PNG to RGBA (`PIL.Image`).
2. **Content detection** - fraction of pixels with alpha > 128. A tile counts as having content if that fraction exceeds 5%. Ocean and void tiles fall below and are flagged `has_content = false`. This drives partial indices and the coverage map colouring.
3. **Dominant colour** - average RGB of opaque pixels, formatted `#rrggbb`. `None` when the tile has no content. Exposed as an `X-Tile-Color` header so clients can pre-paint a background placeholder while the image decodes.
4. **WebP encoding** - lossless, `method=6`. No visual loss versus PNG, smaller payload.

Output `ProcessedTile(data, content_type, size_bytes, dominant_color, has_content)`.

---

## Database

Table `map_tiles`. ORM model in `api-backend/app/db/models/map_tiles.py`. Created by migration `0043_add_map_tiles.py`.

| Column | Type | Notes |
|---|---|---|
| `plane` | SmallInteger PK | 0-3 |
| `z` | SmallInteger PK | Explv zoom 4-11 |
| `x` | Integer PK | TMS tile x |
| `y` | Integer PK | TMS tile y |
| `data` | LargeBinary NOT NULL | WebP bytes |
| `content_type` | String(32) NOT NULL | `image/webp` (allows future format change without migration) |
| `size_bytes` | Integer NOT NULL | stored byte size |
| `dominant_color` | String(7) nullable | `#rrggbb` placeholder colour |
| `has_content` | Boolean NOT NULL | false for ocean/void tiles |
| `region_id` | Integer nullable | OSRS region; null when `z < 6` |
| `fetched_at` | TIMESTAMPTZ NOT NULL | ingest time |

Composite PK `(plane, z, x, y)` gives O(1) lookup and efficient viewport range scans. Data lives in the existing `postgres_data` volume - no new volume needed.

### Storage estimate

| Zoom | Tiles x 4 planes |
|---|---|
| 4 | 192 |
| 5 | 644 |
| 6 | 2 340 |
| 7 | 9 360 |
| 8 | 36 312 |
| 9 | 145 248 |
| **4-9 total** | **~194 096** |

Roughly 20% of the bounding box is land, so the real stored count is well below this. Zoom 10-11 (~2.9M tiles) are lazy-only.

---

## Endpoints

All under prefix `/tiles`. Router package `app/routers/map_tiles/` (`serve.py`, `sync.py`, `management.py`, assembled in `__init__.py`).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/tiles/{plane}/{z}/{x}/{y}` | public | Serve tile; lazy-fetch + cache on miss |
| POST | `/tiles/sync?force=` | `staff.map_tiles:create` | Start background sync |
| POST | `/tiles/sync/stop` | `staff.map_tiles:edit` | Cancel running sync |
| GET | `/tiles/sync/status` | `staff.map_tiles:read` | Running flag, cached count, progress |
| GET | `/tiles/events` | public | SSE live event stream |
| GET | `/tiles/coverage?plane=&z=` | `staff.map_tiles:read` | Cached `[x, y, has_content]` at a zoom |
| DELETE | `/tiles/` | `staff.map_tiles:delete` | Wipe entire cache |
| DELETE | `/tiles/region/{region_id}` | `staff.map_tiles:delete` | Invalidate one OSRS region |

The tile serve endpoint is public (tiles were public on GitHub). It responds with:

```
Content-Type: image/webp
Cache-Control: public, max-age=31536000, immutable
X-Tile-Color: #3a5c2b
X-Tile-Has-Content: true
```

`/tiles/events` is public because browser `EventSource` cannot attach an `Authorization` header. It carries no sensitive data - only tile coordinates and sync progress. The `DELETE /tiles/` route uses a trailing slash because FastAPI rejects a route whose prefix and path are both empty.

---

## Background Sync Service

`app/services/tile_sync.py` - `TileSyncService`, follows the standard start/stop/`is_running` service pattern. Instantiated in `app/main.py` lifespan and stored at `app.state.tile_sync_service`.

Behaviour:

- Ascending zoom walk (`z=4` first) so the most-viewed coarse tiles land earliest.
- Concurrency 8, fixed 100ms delay per completed tile (`TILE_SYNC_CONCURRENCY`, `TILE_SYNC_DELAY_MS`).
- No GitHub token - the raw CDN tolerates a paced one-time sync.
- `404` upstream means the tile does not exist (ocean/void) - skipped, not stored.
- `429`/`403` triggers exponential backoff starting at 60s, up to 5 retries, then skip.
- Without `force`, existing rows are skipped (`ON CONFLICT DO NOTHING`); with `force`, rows are overwritten (`ON CONFLICT DO UPDATE`) - used to refresh after an OSRS map update.

### Progress tracking

The service maintains `_processed`, `_total`, `_current_zoom`, and `_started_at`. `progress()` returns:

```json
{ "processed": 0, "total": 0, "current_zoom": 0, "rate_per_sec": 0.0, "eta_seconds": null }
```

`rate_per_sec` is a running average (`processed / elapsed`); `eta_seconds` divides the remaining count by that rate. `GET /tiles/sync/status` merges this into its response while a sync is running.

Startup behaviour: if `TILE_SYNC_ON_STARTUP=true`, a sync begins during lifespan.

---

## Live Event System

`app/services/tile_events.py` - `TileEventBus`, backed by **Valkey pub/sub** so events fan out across every gunicorn worker. Created in lifespan, stored at `app.state.tile_event_bus`, passed to `TileSyncService`.

- `publish()` sends JSON to the `foundry:tile_events` channel via the shared Valkey client.
- `stream()` opens its own Valkey subscriber connection per SSE client, yields SSE-formatted `data: {json}\n\n` frames, and emits a `: heartbeat` comment every 15s of idle to keep the connection alive.

Because publish/subscribe go through Valkey rather than in-process queues, an SSE client connected to any worker receives events emitted by any other worker (for example the single worker running a sync, or whichever worker served a lazy tile).

Event types:

| Type | Emitted when | Payload |
|---|---|---|
| `sync_started` | sync begins | progress snapshot |
| `sync_progress` | every 100 tiles processed | progress snapshot |
| `sync_complete` | sync finishes | progress snapshot |
| `sync_stopped` | sync cancelled | progress snapshot |
| `tile_fetched` | lazy proxy stores a new tile | `plane, z, x, y, source` |

The lazy serve path publishes `tile_fetched` after a successful store, so the UI shows organic cache growth even when no bulk sync is running.

## Multi-Worker Coordination

The API runs `gunicorn --workers 3`. Tile serving is stateless and DB-backed, so it scales across workers freely. Sync control, in contrast, is coordinated through Valkey (`app/services/tile_sync_state.py`) so it behaves as a single logical operation:

- **Single-flight** - `start()` acquires `foundry:tile_sync:lock` with `SET NX EX 60`. Only the worker that wins the lock runs the crawl; the others return `{"started": false, "reason": "already running"}`. This also makes `TILE_SYNC_ON_STARTUP=true` safe under multiple workers - only one worker begins the startup sync.
- **Shared status** - the running worker writes `{running, processed, total, current_zoom, rate_per_sec, eta_seconds}` to `foundry:tile_sync:state` (TTL 60s, refreshed every 100 tiles). `GET /tiles/sync/status` reads this key, so status is correct on whichever worker answers. If the running worker dies, the key expires and status returns to idle automatically.
- **Cross-worker stop** - `POST /tiles/sync/stop` sets `foundry:tile_sync:stop`. The running worker polls it every 20 tiles and halts cleanly, releasing the lock and emitting `sync_stopped`. If the stop request lands on the same worker that owns the task, it also cancels the local task directly for immediacy.

---

## Frontend

### Tile rendering

`src/components/map/core/coordinates.ts` builds tile URLs against the shared `API_URL` (`window.__API_URL__ ?? "http://localhost:8000"`, injected in prod by `prod-server.ts`) - the same base `apiFetch` uses, so tiles and API calls always target the same origin. `OsrsMap.tsx` draws visible tiles to a canvas and preloads neighbouring zoom levels. Errored images (upstream 404 -> `complete === true`, `naturalWidth === 0`) are skipped without incrementing the pending-redraw counter; the counter attaches both `load` and `error` listeners so a failed fetch cannot deadlock the redraw.

> Earlier `osrsTileUrl` read `import.meta.env.BUN_PUBLIC_API_URL`, which is unset under `bun dev` - tile requests then resolved to the Bun dev server and returned the SPA `index.html` instead of image bytes. Using `API_URL` fixes this and keeps a single source of truth.

### Management page

`src/routes/members/config/map-tiles.tsx` (page id `staff.map_tiles`). Sections top to bottom:

1. **Coverage Map** (`TileCoverageMap.tsx`) - canvas grid selectable across all zoom levels z4-z11. Pixels-per-tile is derived from the grid width (`CANVAS_TARGET_PX / cols`, clamped 1-16) so every zoom renders at a consistent width. Green = cached with content, grey = cached empty tile, cyan = fetched live this session. Polls `/tiles/coverage` and overlays `tile_fetched` SSE events in real time.
2. **Live Event Feed** (`TileEventFeed.tsx`) - scrolling list of the last 80 events with a connection indicator, driven by an `EventSource` on `/tiles/events`.
3. **Cache Status** - running indicator and cached-tile count, react-query polling at 3s while running / 15s idle.
4. **Sync Controls** - start (with force toggle) and stop.
5. **Region Invalidation** - delete one region by ID.
6. **Danger Zone** - wipe the entire cache (confirm-gated).

API client: `src/api/mapTiles.ts` (`mapTilesApi` object + `tileEventsUrl()` helper for the raw SSE URL, since `EventSource` bypasses the authenticated `apiFetch` client).

---

## Configuration

`.env` (see `.env.example`), consumed by `api-backend`:

| Var | Default | Meaning |
|---|---|---|
| `TILE_SYNC_ON_STARTUP` | false | run a full sync during lifespan startup |
| `TILE_SYNC_MAX_ZOOM` | 9 | highest zoom the bulk sync populates |
| `TILE_SYNC_CONCURRENCY` | 8 | concurrent upstream connections |
| `TILE_SYNC_DELAY_MS` | 100 | delay between completed tiles |

web-app:

| Var | Meaning |
|---|---|
| `BUN_PUBLIC_API_URL` | API base URL; tile and SSE requests target it |

---

## File Map

### api-backend
- `app/db/models/map_tiles.py` - `MapTile` ORM model
- `alembic/versions/0043_add_map_tiles.py` - table migration
- `app/routers/map_tiles/` - `__init__.py`, `serve.py`, `sync.py`, `management.py`
- `app/services/tile_processor.py` - PNG -> WebP, colour, content, region id
- `app/services/tile_fetcher.py` - `tile_exists`, `download_tile`, `cache_tile`
- `app/services/tile_crawler.py` - `TileCrawler` (zoom walk + progress counters)
- `app/services/tile_sync.py` - `TileSyncService` (lifecycle + Valkey coordination)
- `app/services/tile_sync_state.py` - Valkey lock / state / stop helpers
- `app/services/tile_events.py` - `TileEventBus` (Valkey pub/sub)
- `app/main.py` - lifespan wiring (`tile_event_bus`, `tile_sync_service`)
- `Dockerfile` - `gunicorn --workers 3`
- `app/tests/test_map_tiles.py` - endpoint, event bus, and sync coordination tests

### web-app
- `src/api/mapTiles.ts` - API client + SSE URL helper
- `src/components/map/core/` - `coordinates.ts`, `OsrsMap.tsx`, `tileCache.ts`
- `src/components/map-tiles/TileCoverageMap.tsx` - live coverage canvas
- `src/components/map-tiles/TileEventFeed.tsx` - SSE event list
- `src/routes/members/config/map-tiles.tsx` - management page
```
