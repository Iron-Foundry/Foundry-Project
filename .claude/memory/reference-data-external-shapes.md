---
name: reference-data-external-shapes
description: verified live shapes of the OSRS Wiki drop-table and WOM efficiency-rate sources feeding api-backend reference data
metadata:
  type: reference
---

External source shapes for the api-backend loot/EHP-EHB reference-data subsystem (routers `app/routers/reference/`, services `app/services/loot_tables/` + `app/services/efficiency_rates/`), verified against live responses 2026-07-26.

**OSRS Wiki drop tables** - no cache/structured API; drops live in page wikitext. Fetch via MediaWiki `GET https://oldschool.runescape.wiki/api.php?action=parse&page=<Page>&prop=wikitext&format=json&redirects=1` (`OsrsWikiContentHandler`). Under the `==Drops==` H2, each `===Sub===` header is the drop group; rows are `{{DropsLine|name=|quantity=|rarity=|rolls=}}` (quantity like `100-299`, `1000 (noted)`; rarity `Always` or `1/1024`). `===Rare drop table===` is a `{{Rare drop table}}` transclusion, not inline DropsLines (parser skips it). Only bosses+activities pages parsed; item ids resolved via osrs-cache-service `/items/names`.

**WOM efficiency rates** - `GET https://api.wiseoldman.net/v2/efficiency/rates?metric={ehb|ehp}&type=ironman` (needs the rate-limited `WomRequestQueue`, started in app lifespan). EHB = flat `[{"boss": slug, "rate": kph}]`. EHP = `[{"skill": slug, "methods": [{"startExp","rate","description"}], "bonuses": []}]` (tiered by xp; we store peak rate + full tiers in JSONB `payload`). Keys are WOM metric slugs, so they align with the existing metric catalog ([[integration-testing]] catalog files). Only ironman rates are stored (user decision).
