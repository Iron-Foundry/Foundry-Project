---
name: recursive-settimeout-over-setinterval
description: never poll/animate with setInterval; use a self-scheduling recursive setTimeout
metadata:
  type: feedback
---

For any repeating timer (polling, animation ticks), never use `setInterval`. Use a
recursive `setTimeout` that schedules the next tick only after the current one's work
finishes.

**Why:** `setInterval` fires on a fixed wall-clock cadence regardless of how long the
callback takes. If the work (e.g. an async fetch) runs longer than the interval, ticks
queue up and pollute the event-loop/exec thread, and each tick drifts further behind.
A recursive `setTimeout` schedules the next tick *after* the work completes, so a 50ms
timer with 100ms work becomes a steady ~150ms gap with no pileup, instead of an
ever-growing backlog.

**How to apply:** in a `useEffect`, keep a `cancelled` flag and a `timer` ref;
`schedule()` = `setTimeout(async () => { await work(); if (!cancelled) schedule(); }, ms)`;
cleanup sets `cancelled = true` and `clearTimeout(timer)`. For animation ticks, store the
timeout id in the same ref you already `clearTimeout` in stop/cleanup. Converted sites:
`web-app` ranking status poll, competitions countdown, tilerace DiceRoller.

Relates to [[osrs-map-embed-sizing]] (rAF-loop lifecycle discipline on unmount).
