# OSRSClans request: a collection log flag on loot rates

Foundry row FRZ-6 needs this. When staff add a frenzy card for a boss or NPC, Foundry adds that source's unique drops. A unique drop is an item on the collection log page that the source fills.

## The gap

`/api/v1/loot-rates` rows carry no mark of a unique drop. The `group` field does not separate them. For example, `source=Vorkath#Post-quest` (84 rows on 2026-11-26) puts Vorkath's head, Vorki, Jar of decay and the visages in `Tertiary`, beside Blue dragon bone, Brimstone key and Clue scroll (elite). The game cache defines the collection log pages and their items, so this is a gap in the data, not in the game.

## The shape Foundry wants

### On each `/loot-rates` row

| Field | Type | Value |
| --- | --- | --- |
| `collectionLog` | boolean | true when the item is on the collection log page that this row's source fills. False otherwise. |
| `collectionLogPage` | string or null | the name of that page, such as `"Vorkath"`. Null when `collectionLog` is false. |

The flag belongs to the source and item pair, not to the item alone:

- An item on the page of a different source is false on this source. For example, a Dragon pickaxe from a boss whose page does not list it.
- An item on a shared page is true for each source that fills that page.
- A pet is true when the pet is on that source's page.
- A raid unique is true on the raid's rows, and `perPurple` and `chancePerRaid` stay as they are.

### A filter on `/loot-rates`

`collectionLog=true` returns only the flagged rows. With `source=`, it returns one source's uniques in one request. Foundry calls `/loot-rates?source=<source>&collectionLog=true&limit=100`.

### On each `/loot-rates/sources` row

| Field | Type | Value |
| --- | --- | --- |
| `collectionLogPage` | string or null | the page this source fills, or null when it fills none |
| `collectionLogRows` | integer | the count of this source's flagged rows |

With these fields, the card picker can show which sources have uniques before staff add a card.

## The check Foundry runs

`/loot-rates?source=Vorkath%23Post-quest&collectionLog=true` returns 6 rows: Vorkath's head, Vorki, Jar of decay, Dragonbone necklace, Draconic visage and Skeletal visage. It returns no bones, keys, clue scrolls or rare drop table rows. Foundry assumes these 6 items from the game's Vorkath page. The page in the cache settles it.

## Status

Spec 1.14.5 (2026-11-26) ships the fields and the `collectionLog` filter, and the Vorkath check passes. A raid's uniques come from a chest source: Chambers of Xeric is `Ancient chest`, and only `collectionLogPage` names the raid. OSRSClans adds no page filter. Foundry reads all flagged sources with `/loot-rates/sources?collectionLog=true` (two windows of 500), keeps those whose `collectionLogPage` matches, then reads each kept source's flagged rows. api-backend serves the result at `GET /reference/loot-rates/collection-log?name=`.

## Spec

Add the fields to the OpenAPI spec and bump the spec version. Foundry checks the live spec at `https://osrsclans.cc/openapi.json` before it builds against the fields.
