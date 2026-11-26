---
type: ai-context
name: todo-salt
summary: Salt's open work in the Foundry monorepo. One row per item, each with the gate that proves it.
---

# TODO - Salt

Rows are open work only. A row leaves when its gate holds.

| id | item | gate |
| --- | --- | --- |
| FRZ-6 | Adding a frenzy card for a boss or NPC that OSRSClans knows adds all its unique drops. Built: leaving the card name field adds the drops of the matching collection log page (`GET /reference/loot-rates/collection-log`). Salt checks it on the dev site | Adding a Vorkath card adds Vorkath's collection log drops and no other rows, a test covers it, and the lanes are green |
| FRZ-4 | Frenzy automatic intake via clansocket through OSRSClans | A drop that clansocket reports through OSRSClans lands as a frenzy submission for the player's team without staff input, a test covers it, and the lanes are green |
| FRZ-5 | Frenzy manual submissions on the website: a team member files an item, activity or milestone with proof | A member's submission lands as pending for staff review, an endpoint test covers it, and the lanes are green |
| OPS-1 | Deploy api-backend `4c99536` and discord-utils `47e13b2` to prod together. api-backend also carries the Ironclad ingest removal and the CORS fix on the cache JSON routes. discord-utils stops relayed chat from pinging, which the decoded `<at>` makes necessary | A new tagged broadcast in prod stores its own event type, with resolved numbers and no `<int_`, `<str_` or `<switch,` text, and an in-game `@everyone` relays without a ping |
| OPS-2 | After OPS-1, run `./run backfill-events prod`, read the counts, then run `./run backfill-events prod --apply` | A second dry run lists only coffer, clan leave and expel rows as left as is, and the reparse step reports `Would update 0 event(s)` |
| OPS-3 | Delete `IRONCLAD_WEBHOOK_URL` from Infisical in dev, staging and prod. No code reads it | `infisical secrets get IRONCLAD_WEBHOOK_URL` finds no secret in the three environments |
