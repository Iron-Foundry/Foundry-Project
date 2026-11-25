---
type: ai-context
name: todo-salt
summary: Salt's open work in the Foundry monorepo. One row per item, each with the gate that proves it.
---

# TODO - Salt

Rows are open work only. A row leaves when its gate holds.

| id | item | gate |
| --- | --- | --- |
| RDM-1 | Drop `osrs-cache-service` from Foundry and rely on osrsclans for OSRS cache data instead | No Foundry service or surface reads `osrs-cache-service`, and `foundry-all` is green |
| RDM-2 | Redesign the entire site with more consistent, bespoke, reused components: candidates on the preview bench first, then Salt's pick built into `web-app` | Salt approves the site on the dev site, and `foundry-lint` and `foundry-fast` are green |
| FRZ-1 | Balance frenzy on OSRSClans `/api/v1/loot-rates`. Step 1: api-backend reads loot rates from OSRSClans through one cached client, and `LootTablesService` and its Wiki scrape go. Step 2: the frenzy item editor fills `drop_denom` and `kph` from a picked source row. Step 3: a raid unique balances on `chancePerRaid` at the asked `points` and `raidLevel`, and a row with no kill rate stays editable by hand and shows as unbalanced. Step 4: a row with no OSRSClans kill rate takes its rate from Foundry. The notable ones are in `designs/OSRSCLANS_NO_KILL_RATE.md`. Game mode variants, Nightmare Zone copies, Corrupted and Crystalline Gauntlet creatures, the Supply crate, the Tempoross Casket (Reward pool) and the Gauntlet Failure chest stay out. Step 5: the staff reference page moves to `/loot-rates/sources` and `/loot-rates?page=`, grouped by `group` | No Foundry code scrapes Wiki drop tables, a frenzy item gets its hours per drop from a picked loot rate row, and `foundry-lint`, `foundry-fast` and `foundry-integration` are green |
| OPS-1 | Deploy api-backend `4c99536` and discord-utils `47e13b2` to prod together. api-backend also carries the Ironclad ingest removal and the CORS fix on the cache JSON routes. discord-utils stops relayed chat from pinging, which the decoded `<at>` makes necessary | A new tagged broadcast in prod stores its own event type, with resolved numbers and no `<int_`, `<str_` or `<switch,` text, and an in-game `@everyone` relays without a ping |
| OPS-2 | After OPS-1, run `./run backfill-events prod`, read the counts, then run `./run backfill-events prod --apply` | A second dry run lists only coffer, clan leave and expel rows as left as is, and the reparse step reports `Would update 0 event(s)` |
| OPS-3 | Delete `IRONCLAD_WEBHOOK_URL` from Infisical in dev, staging and prod. No code reads it | `infisical secrets get IRONCLAD_WEBHOOK_URL` finds no secret in the three environments |
| OPS-4 | Decide whether the Ranking Filter button gets a function or leaves the site. It does nothing today, and the RDM-2 skin leaves it out | Salt's answer is recorded here, and the RDM-2 bench matches it |
| OPS-5 | Decide whether the Feedback Edit button gets a function or leaves the site. It does nothing today | Salt's answer is recorded here, and the RDM-2 bench matches it |
| OPS-6 | Decide whether signed-out visitors see the Our Team avatars | Salt's answer is recorded here, and the RDM-2 bench matches it |
| OPS-7 | Decide which permission ids the Manage pages check: `frenzy`/`tilerace` or `frenzy.admin`/`tilerace.admin` | Salt's answer is recorded here, and one id set remains in the code |
| OPS-8 | Decide whether the Tile Race progress bar keeps its infinite animation. The RDM-2 skin draws it static, and `nothing_repaints_forever` allows a loop only as an approved exception | Salt's answer is recorded here, and the RDM-2 bench matches it |
| OPS-9 | Give the word to start RDM-2 batch 2, the members area on the preview bench | Salt's word is given, and the batch 2 candidates are on the bench |
