---
name: cache-image-cors
description: Proxied osrs-cache image endpoints must send Access-Control-Allow-Origin:* or cross-origin fetch/canvas/preview loads break
metadata:
  type: project
---

The image endpoints in `api-backend/app/routers/osrs_cache.py`
(`/item-icons/{id}`, `/item-icons/{id}/render`, `/sprites/{id}/{frame}`) must serve
`Access-Control-Allow-Origin: *` (constants `_IMMUTABLE_IMAGE_HEADERS` /
`_RENDER_IMAGE_HEADERS`).

**Why:** the global CORSMiddleware only reflects `FRONTEND_URL` origins, so without
the wildcard, cross-origin `fetch()`/blob/canvas/preview/embed loads of these public
images fail CORS. Plain `<img>` display still works, which makes it easy to miss -
it surfaced as broken item image previews after icons moved off the permissive CDNs.

**How to apply:** any new public image response from the cache proxy gets the
wildcard header. Mirrors the cache-tiles nginx sidecar
(`osrs-cache-service/deploy/tiles.nginx.conf`) and the static.runelite.net / wiki
CDNs these replaced, all of which send `*`. See [[cache-icon-coverage]].
