> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

THIS POLICY ENFORCES that an LLM agent consuming Iron Foundry OSRS data fetches every item definition, item name, and item icon from the Iron Foundry cache API - correctly encoded, correctly defaulted, and correctly cached.

%% META %%:
    intent: "Give an autonomous agent everything it needs to call the OSRS item API right on the first try"
    objective: "Every item lookup and every item image the agent produces resolves through api.ironfoundry.cc/osrs-cache/*"
    context: "The API decodes the live OSRS game cache and renders item icons from each item's 3D inventory model. Read-only, unauthenticated, CORS-open. Only the current game build is served."
    criteria: "No fabricated endpoint, no unencoded query, no per-row lookup, no ignored 404"
    priority: high
    trust: openapi_document = AUTHORITATIVE, this_document = GUIDANCE, model_prior_knowledge = UNTRUSTED

DECLARE base_url: string
DECLARE docs_url: string
DECLARE openapi_url: string

SET base_url = "https://api.ironfoundry.cc"
SET docs_url = "https://api.ironfoundry.cc/docs"
SET openapi_url = "https://api.ironfoundry.cc/openapi.json"

    @purpose: "docs_url is the human reference (Scalar, tag group `osrs-cache`). openapi_url is the machine contract - when this document and openapi_url disagree, openapi_url wins."

# PHASE 1: GROUND RULES
    @purpose: "What the agent may assume before it sends anything"

    RULE the_api_is_open_and_read_only:
        ALWAYS SEND plain "GET" REQUESTS
        NEVER SEND an Authorization header, an API key, or a cookie - none is required and none is accepted
        NEVER ATTEMPT POST / PUT / PATCH / DELETE - the surface is read-only

    RULE never_invent_an_endpoint:
        ALWAYS USE a path listed IN PHASE 2 OR present IN openapi_url
        WHEN unsure whether a route exists:
            READ openapi_url FIRST
        NEVER GUESS a path FROM another OSRS API's shape

    RULE single_current_build:
        ALWAYS ASSUME the API serves exactly one game cache build - the newest ingested one
        NEVER PASS a build id, a revision, or a date parameter - there is no history
        WHEN build freshness matters:
            READ base_url + "/osrs-cache/meta" FOR the live build id AND definition counts

    RULE identify_yourself:
        ALWAYS SET a descriptive "User-Agent" (tool name + contact)
        ALWAYS KEEP concurrency modest (<= 4 in flight) AND cache aggressively per PHASE 5

    VALIDATION GATE:
        ✅ request is a GET against a documented path
        ✅ no auth material attached
        ✅ no build/revision parameter invented
        ✅ User-Agent set

# PHASE 2: THE SURFACE
    @purpose: "Every route the agent needs, with its exact parameters"

    ## Item definitions - JSON

    | Method + path | Returns | Parameters |
    |---|---|---|
    | `GET /osrs-cache/meta` | current build id, definition counts | none |
    | `GET /osrs-cache/items` | array of item objects | `search` (substring, case-insensitive), `limit` (1..500, default 50), `offset` (>= 0, default 0) |
    | `GET /osrs-cache/items/names` | object mapping `"<item_id>"` -> `"<name>"` | none |
    | `GET /osrs-cache/items/{item_id}` | one item object | path `item_id` (integer >= 0) |
    | `GET /osrs-cache/items/{item_id}/variants` | array of item objects | path `item_id` |

    An item object carries the decoded definition: `item_id`, `name`, `members`, stack
    and note/placeholder links, and the 2D render recipe (`inventory_model`, rotation,
    resize, lighting, recolour tables). Field-exact shapes live in `openapi_url`.

    `/variants` returns the noted, placeholder, and charged forms that share a base
    name - use it to answer "which ids are the same thing".

    ## Item imagery - binary

    | Method + path | Returns | Parameters |
    |---|---|---|
    | `GET /osrs-cache/item-icons/{item_id}` | pre-baked 512 px lossless WebP | none |
    | `GET /osrs-cache/item-icons/{item_id}/render` | WebP rendered on demand | `size` (32..4096, default 512) |

    Noted and placeholder ids resolve to their base item's icon automatically, so a
    tag/bank id will not 404 merely for being a note.

    ## Adjacent surfaces (same rules apply)

    `GET /osrs-cache/npcs`, `GET /osrs-cache/objects` (same `search`/`limit`/`offset`),
    `GET /osrs-cache/sprites` + `GET /osrs-cache/sprites/{sprite_id}/{frame_index}`
    (`format=png|webp`, `scale=1..32`) for UI sprites such as skill icons, and the
    `GET /osrs-cache/map/*` family for world-map data.

    VALIDATION GATE:
        ✅ chosen route matches the intent (search vs id vs variants vs bulk map)
        ✅ every parameter used appears in the table for that route
        ✅ item shape assumptions checked against openapi_url before being relied on

# PHASE 3: URL CONSTRUCTION AND ENCODING
    @purpose: "OSRS item names contain spaces, apostrophes, parentheses, plus signs and slashes - an unencoded query silently returns the wrong rows or a 4xx"

    RULE encode_every_dynamic_value:
        ALWAYS BUILD the query string WITH a real encoder
        NEVER CONCATENATE a raw name INTO a URL

    ```text
    WRONG   /osrs-cache/items?search=Zamorak's staff (or)
    RIGHT   /osrs-cache/items?search=Zamorak%27s%20staff%20%28or%29
    ```

    ```python
    import httpx
    r = httpx.get(
        "https://api.ironfoundry.cc/osrs-cache/items",
        params={"search": "Zamorak's staff (or)", "limit": 50},  # httpx encodes
        headers={"User-Agent": "my-tool/1.0 (contact@example.com)"},
        timeout=10.0,
    )
    ```

    ```ts
    const params = new URLSearchParams({ limit: "50", offset: "0" });
    if (search) params.set("search", search);
    const res = await fetch(`https://api.ironfoundry.cc/osrs-cache/items?${params}`);
    ```

    ```bash
    curl -G "https://api.ironfoundry.cc/osrs-cache/items" \
         --data-urlencode "search=Zamorak's staff (or)" \
         -H "User-Agent: my-tool/1.0"
    ```

    RULE path_segments_are_integers:
        ALWAYS PASS item_id AS a non-negative integer
        NEVER PUT a name IN a path segment - RESOLVE it FIRST VIA "/items?search="
        # a name in the id slot is a 422, not a lookup

    RULE keep_percent_encoding_intact:
        WHEN emitting an icon URL INTO markdown, HTML, or a chat message:
            ALWAYS EMIT the encoded form
            NEVER RE-DECODE it FOR readability

    VALIDATION GATE:
        ✅ no string concatenation of a user term into a URL
        ✅ ids are validated integers
        ✅ emitted URLs stay percent-encoded

# PHASE 4: CUSTOM RENDERS
    @purpose: "When to ask for a size, and what it costs"

    `GET /osrs-cache/item-icons/{item_id}/render?size=N`

    The item is rendered from its 3D inventory model at request time through the same
    pipeline as the baked icon - auto-fit camera, back-face culling, per-pixel z-buffer,
    two-pass transparency, UV-mapped textures. It is slower than the baked icon and is
    not cached at the edge.

    | Setting | Value |
    |---|---|
    | `size` default | `512` |
    | `size` range | `32` .. `4096` (outside the range is `422`) |
    | Recommended values | `32, 64, 128, 256, 512, 1024, 2048, 4096` |
    | Response media type | `image/webp`, lossless |
    | `Cache-Control` | `no-store` |
    | Suggested client timeout | 30 s |

    RULE default_to_the_baked_icon:
        WHEN displaying icons IN a list, grid, table, tooltip, embed, or chat message:
            ALWAYS USE "/item-icons/{item_id}" AND scale it client-side
            # 512 px lossless WebP, served with Cache-Control: public, max-age=31536000, immutable
        WHEN the user is exporting, printing, or compositing AT a chosen resolution:
            USE "/render?size=N" WITH N FROM the recommended values
        NEVER LOOP "/render" OVER a list of items - that is the one call pattern that hurts

    RULE ask_for_a_power_of_two:
        ALWAYS REQUEST the smallest size that covers the display size
        NEVER REQUEST 4096 BY default

    VALIDATION GATE:
        ✅ `/render` calls are single-item and user-initiated
        ✅ `size` inside 32..4096
        ✅ bulk display paths use the baked icon

# PHASE 5: DEFAULTS, FORMATS, CACHING
    @purpose: "What to assume when nothing is specified"

    ## Parameter defaults

    | Parameter | Default | Bounds |
    |---|---|---|
    | `search` | unset - returns the id-ordered page | substring match, case-insensitive |
    | `limit` (items, npcs, objects) | `50` | 1 .. 500 |
    | `limit` (sprites) | `100` | 1 .. 500 |
    | `offset` | `0` | >= 0 |
    | `size` (item render) | `512` | 32 .. 4096 |
    | `format` (sprites) | `png` | `png` \| `webp` |
    | `scale` (sprites) | unset (1x) | 1 .. 32 |

    ## Formats

    - Definition routes return JSON. `/items/names` returns an object keyed by the item
      id **as a string** - convert to int on the way in.
    - Item icons are always WebP. Sprites default to PNG and accept WebP.
    - Image routes send `Access-Control-Allow-Origin: *`, so a browser may load them
      directly, including into a canvas.

    ## Caching duties

    | Resource | Server policy | What the agent should do |
    |---|---|---|
    | `/item-icons/{id}` | `public, max-age=31536000, immutable` | cache forever; hotlink freely |
    | `/item-icons/{id}/render` | `no-store` | cache the bytes yourself if reused |
    | `/items/names` | large payload, whole-catalogue | fetch ONCE per session, keep in memory |
    | `/items`, `/items/{id}` | JSON | cache per build id from `/meta` |

    RULE bulk_over_per_row:
        WHEN more than ~20 ids need names:
            FETCH "/items/names" ONCE
        NEVER CALL "/items/{item_id}" once per row

    RULE paginate_dont_hammer:
        ALWAYS PAGE WITH `limit` + `offset` UNTIL a short page returns
        NEVER REQUEST limit > 500
        WHEN the whole catalogue is wanted:
            USE "/items/names" INSTEAD OF paging to exhaustion

    VALIDATION GATE:
        ✅ no request exceeds a documented bound
        ✅ name resolution is bulk, not per-row
        ✅ immutable icons cached, `no-store` renders cached client-side if reused

# PHASE 6: ERRORS AND FAILURE HANDLING
    @purpose: "Every status the agent will actually see, and the correct response to it"

    | Status | Meaning | Correct action |
    |---|---|---|
    | `200` | success | proceed |
    | `404` | item, icon, or sprite does not exist in this build | report "not found"; for icons, show a placeholder |
    | `422` | a parameter failed validation (non-integer id, `size` out of range, bad `format`) | fix the request; do NOT retry unchanged |
    | `502` | upstream cache service unavailable | retry with backoff (2 s, 8 s, 30 s), then report |
    | `503` | service starting or ingesting | retry with backoff |

    RULE a_404_on_an_icon_is_normal:
        WHEN "/item-icons/{item_id}" RETURNS 404:
            TREAT it AS "this item has no visual model" - notes, placeholders and
            currency rows genuinely have none
            RENDER a neutral placeholder
            NEVER SUBSTITUTE an image FROM another host AND present it AS ours

    RULE never_fabricate_data:
        WHEN a lookup fails OR a field is absent:
            REPORT the gap
            NEVER INVENT an item id, a name, an icon URL, or a stat
        # ids are stable within a build but not memorisable - always resolve, never recall

    RULE degrade_loudly:
        WHEN the API is unreachable AFTER backoff:
            REPORT the failure TO the user
            NEVER SILENTLY FALL BACK TO a third-party OSRS source AND label it Iron Foundry data

    VALIDATION GATE:
        ✅ each status handled per the table
        ✅ 422 fixed rather than retried
        ✅ no fabricated ids, names, or URLs
        ✅ failures surfaced, not papered over

# PHASE 7: WORKED FLOWS
    @purpose: "The three request shapes that cover almost every task"

    STEP name_to_icon:
        GET "/osrs-cache/items?search=<encoded name>&limit=10"
        SET item_id = first result whose `name` matches the intent
        EMIT "https://api.ironfoundry.cc/osrs-cache/item-icons/" + item_id

    STEP id_list_to_names:
        GET "/osrs-cache/items/names"          # once per session
        SET names = parsed object              # keys are strings
        FOR EACH id IN id_list:
            SET label = names[String(id)] OR "Unknown item " + id

    STEP high_resolution_export:
        GET "/osrs-cache/items/{item_id}"      # confirm it exists and has a model
        GET "/osrs-cache/item-icons/{item_id}/render?size=1024"
        WRITE the WebP bytes TO the export

    VALIDATION GATE:
        ✅ search results disambiguated by name before an id is used
        ✅ bulk names fetched once
        ✅ export path confirms the item before rendering

ALWAYS:
    - READ openapi_url WHEN this document is silent or ambiguous
    - ENCODE every dynamic query value
    - DEFAULT TO the baked 512 px icon AND scale client-side
    - RESOLVE ids THROUGH the API instead of recalling them
    - CACHE immutable icons AND the bulk name map

NEVER:
    - INVENT an endpoint, an item id, or an icon URL
    - SEND auth material, or any method other than GET
    - CONCATENATE an unencoded name INTO a URL
    - CALL /render ACROSS a list of items
    - PASS a build id or assume more than the current build exists
    - SUBSTITUTE a third-party image AND present it AS Iron Foundry data
