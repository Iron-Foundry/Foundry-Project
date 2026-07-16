---
name: cache-icon-coverage
description: What images osrs-cache-service can serve (item icons + UI sprites only, no NPC/boss art) and how web-app sources them off the Wiki
metadata:
  type: project
---

osrs-cache-service renders **item icons** (from each item's `inventory_model`) and
decodes **UI sprites** (archive 8; skill stat icons are the `Staticons`/`Staticons2`
sprite group, ATTACK=197 ... SAILING=228). It does NOT render NPC/monster/boss
artwork - there is no NPC-icon renderer, only item + sprite.

**Why:** decides what OSRS imagery can move off the Wiki onto the cache. Item icons,
item id->name and skill icons are replaceable; boss/monster art, spellbook/artwork/
collection-log images and wiki page summaries are not (NPC rendering would mean
decoding the cache further - a new feature, out of scope).

**How to apply:** web-app sources item icons, id->name and skill icons via the
api-backend `/osrs-cache/*` proxy - `web-app/src/components/runelite/bankTag.ts`
(`itemIconUrl`), `hooks/useItemNames.ts`, `lib/skillSprites.ts`. Boss icons in
`lib/wikiIcons.ts` (BOSS_ICON) deliberately stay on the Wiki. `/item-icons/{id}`
resolves noted/placeholder ids to their base item's icon so bank tags don't 404.
Bulk id->name is `/osrs-cache/items/names`; the Frenzy/tilerace item-search list
comes from `/items/catalog` (icon-having items only) via `_refresh_osrs_items` (no
prices.runescape.wiki left). Tilerace derives tile icons client-side from `item_id`
so already-saved tiles render cache icons. See [[cache-image-cors]].
