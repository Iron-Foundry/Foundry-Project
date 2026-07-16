---
name: osrs-map-embed-sizing
description: OSRS maps rendered blank with dead pan/zoom in dev because the rAF loop ref wasn't nulled on unmount, wedging it after StrictMode's remount
metadata:
  type: project
---

`OsrsMap` (web-app `src/components/map/core/OsrsMap.tsx`) drives its tile canvas with
a `requestAnimationFrame` loop gated by `ensureLoop`'s `if (rafRef.current === null)`.
The real cause of "maps render blank, pan and zoom dead" (dev only): the unmount
cleanup **cancelled** the pending rAF but did not reset `rafRef.current` to null. React
StrictMode mounts -> unmounts -> remounts; after the unmount `rafRef.current` stayed a
stale id, so on remount every `markDirty` saw a non-null ref and never scheduled a
frame. `frame` (thus `drawCanvas`) never ran again -> blank, and pan/zoom (which also
route through `markDirty`) did nothing. Prod (no StrictMode) happened to work, which is
why it looked environmental and "was never fixed." Fix: cleanup nulls the ref after
cancelling.

Debugging lesson: the decisive signal was that `ResizeObserver` and `meta loaded`
logged but `drawCanvas` NEVER logged - i.e. the loop, not size/coverage/tiles. Size
(197x197), coverage, tile URLs, and CORS were all fine; earlier size/coverage/plane
theories were wrong. If a canvas-loop component is dead, instrument the loop first.

Two smaller, still-valid fixes made alongside: a `sizeRef` staleness race in the RO
callback (sets `sizeRef.current` synchronously before `markDirty`), and tile-marker
embeds fill their `relative aspect-square` box with `absolute inset-0` rather than
`h-full`. Neither was the blank's cause. See [[osrs-cache-service-map-module]].
