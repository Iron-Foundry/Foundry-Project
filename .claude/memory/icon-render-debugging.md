---
name: icon-render-debugging
description: how to debug osrs-cache-service item-icon renders - inspect output directly, don't guess-and-rebuild
metadata:
  type: feedback
---

When debugging `osrs-cache-service` item-icon rendering, **look at the actual rendered pixels before changing code** - do not guess a fix and trigger a full rebuild+re-ingest (~8 min each). Several rebuild cycles were wasted guessing.

**Fast in-container render loop (no rebuild):**
1. Edit `app/models/rasterizer.py` locally.
2. `docker cp` it into the running container over `/app/app/models/rasterizer.py` (numba kernels are cached; pure-Python edits need no recompile).
3. Run a dump script with `docker exec -w /app -e PYTHONPATH=/app <cid> /app/.venv/bin/python /tmp/script.py` (NOT the system `python` - it lacks numpy; use the venv). On Git Bash prefix `MSYS_NO_PATHCONV=1` so `/app/...` isn't mangled.
4. Script loads item + model from the DB (`RawGroup` has archives 8/9/255), runs `prepare_geometry`/`render_from_geometry`, and prints the PNG as base64 between markers; decode + view locally.
5. To view a *baked* icon, curl `http://localhost:8100/item-icons/<id>` - but only AFTER `now current` logs, since the ingest transaction commits (and swaps the served build) only after the map bake finishes.

**Why:** the render pipeline is subtle and only visually verifiable. Ground truth is clansocket (`ClanSocketItemSpriteExtractor` + `GPUIconRenderer` + `ItemLighter`), not just RuneLite. The single biggest bug was using `zoom2d` as the camera distance instead of clansocket's **auto-fit bounding-box camera** - many items have `zoom2d` unset, which rendered them blank. See `osrs-cache-service/CLAUDE.md` "Item icons".

**How to apply:** for any icon-appearance bug, reproduce with the in-container loop and view it first; fix; re-view in-container; only then rebuild+ingest once. Related: [[check-refs-before-asking]].
