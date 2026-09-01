---
name: wiki-cargo-is-gone
description: The OSRS Wiki no longer serves action=cargoquery; use core action=query, and take names from our own cache
metadata:
  type: reference
---

`https://oldschool.runescape.wiki/api.php?action=cargoquery` returns
`{"error":{"code":"badvalue"}}` with **HTTP 200** - the Cargo extension is gone.
Confirmed live 2026-09-02. Core MediaWiki actions still work; `action=query` with
`prop=pageimages&pithumbsize=N&redirects=1` returns a lead-image thumbnail and
accepts up to 50 `titles=` separated by `|`. That is wrapped as
`OsrsWikiContentHandler.get_page_thumbnails` in `api-backend`.

**Why:** the 200-with-an-error-body is the trap. `raise_for_status()` passes, the
parse finds no rows, and the endpoint returns `[]` forever with nothing in the logs.
The tile editor's NPC search sat broken this way until a user noticed.

**How to apply:** never reach for a Cargo table. For anything the cache owns -
item and NPC names, ids, definitions - query osrs-cache-service instead
([[cache-icon-coverage]], `.claude/rules/osrs-item-sources.md`); ask the wiki only
for NPC/boss artwork, and let a wiki failure cost the image rather than the whole
result. When a third party answers 200, check the body shape, not just the status.
