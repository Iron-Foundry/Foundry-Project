> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

THIS POLICY ENFORCES that every OSRS item definition, item name, and item icon rendered by any Iron Foundry surface is fetched from the owned cache-service endpoints, never from a third-party OSRS image host or item API.

%% META %%:
    intent: "One owned source of truth for OSRS item data and item imagery, at a URL we control and can cache forever"
    objective: "No surface ships an item name, definition, or icon sourced outside /osrs-cache/*"
    context: "osrs-cache-service decodes the live game cache and renders item icons from each item's inventory_model; api-backend proxies it read-only at /osrs-cache/*"
    criteria: "Every item id -> pixels or item id -> name path resolves through /osrs-cache/*, URL-encoded, with the documented defaults"
    priority: high
    trust: cache_service = AUTHORITATIVE, third_party_item_host = FORBIDDEN, wiki_npc_art = PERMITTED_EXCEPTION

DECLARE api_base: string
DECLARE internal_base: string
DECLARE docs_url: string
DECLARE openapi_url: string

SET api_base = "https://api.ironfoundry.cc"          # local development: http://localhost:8000
SET internal_base = "http://osrs-cache-service:8100"  # server-side only, never emitted to a browser
SET docs_url = "https://api.ironfoundry.cc/docs"      # Scalar reference, tag group "osrs-cache"
SET openapi_url = "https://api.ironfoundry.cc/openapi.json"

# PHASE 1: SOURCE SELECTION
    @purpose: "Decide where an OSRS asset comes from before a single URL is written"

    RULE cache_service_is_the_source:
        WHEN a surface needs an item definition, an item id -> name lookup, an item icon, or a UI sprite:
            ALWAYS FETCH it FROM api_base + "/osrs-cache/..."
            NEVER FETCH it FROM oldschool.runescape.wiki, prices.runescape.wiki, osrsbox, chisel.weirdgloop.org, or any other third-party item host
            NEVER RE-HOST a copy in the repo, in an S3 bucket, or in a hardcoded id -> URL table

    RULE browser_never_talks_to_the_cache_service:
        ALWAYS ROUTE browser and Discord traffic THROUGH the api_base proxy
        NEVER EMIT internal_base INTO markup, an embed, a message, or a client bundle
        # internal_base is reachable only inside the `foundry` docker network

    RULE permitted_exception_npc_art:
        WHEN the asset is NPC / boss / monster artwork, a spellbook image, a collection-log image, or a wiki page summary:
            ALLOW the OSRS Wiki AS the source
            # the cache renders item icons and UI sprites only - there is no NPC renderer
        WHEN the asset is an item icon or a skill icon:
            NEVER FALL BACK TO the Wiki - both exist in the cache

    VALIDATION GATE:
        ✅ every new item image/name/definition path points at /osrs-cache/*
        ✅ no third-party item host appears in the diff
        ✅ internal_base appears only in server-side code
        ✅ any Wiki URL in the diff is NPC/artwork/summary, not an item or skill icon

# PHASE 2: ENDPOINTS
    @purpose: "The read-only surface. All GET, all unauthenticated, all documented at docs_url"

    ## Definitions (JSON)

    | Endpoint | Returns | Notes |
    |---|---|---|
    | `GET /osrs-cache/meta` | current build id + definition counts | cheap freshness probe |
    | `GET /osrs-cache/items?search=&limit=&offset=` | `ItemOut[]` | name search, `ilike %term%` |
    | `GET /osrs-cache/items/names` | `{ "<item_id>": "<name>" }` | full map, fetch ONCE per session |
    | `GET /osrs-cache/items/{item_id}` | `ItemOut` | 404 when absent |
    | `GET /osrs-cache/items/{item_id}/variants` | `ItemOut[]` | noted / placeholder / charged forms |

    ## Imagery (binary)

    | Endpoint | Returns | Notes |
    |---|---|---|
    | `GET /osrs-cache/item-icons/{item_id}` | baked 512px lossless WebP | THE default; noted/placeholder ids resolve to their base item |
    | `GET /osrs-cache/item-icons/{item_id}/render?size=N` | on-demand WebP at N px | custom renders, PHASE 4 |
    | `GET /osrs-cache/sprites/{sprite_id}/{frame_index}?format=&scale=` | UI sprite frame | skill icons live here (`Staticons`) |

    RULE prefer_the_baked_icon:
        ALWAYS USE "/item-icons/{item_id}" AS the default icon URL
        # immutable, max-age=31536000, no render cost
        USE "/render" ONLY WHEN a specific pixel size is genuinely required

    RULE bulk_names_once:
        ALWAYS FETCH "/items/names" ONCE per session AND cache it forever in memory
        NEVER CALL "/items/{item_id}" per row TO resolve a name in a list

    VALIDATION GATE:
        ✅ list/grid surfaces use the bulk name map, not per-item lookups
        ✅ icon `src` values default to the baked path
        ✅ no endpoint outside this table is invented for item data

# PHASE 3: URL CONSTRUCTION AND ENCODING
    @purpose: "Item names carry spaces, apostrophes, parentheses and slashes - unencoded they corrupt the query"

    RULE encode_every_dynamic_segment:
        ALWAYS BUILD query strings WITH `URLSearchParams` (TypeScript) OR httpx `params=` (Python)
        NEVER CONCATENATE a raw item name INTO a URL
        WHEN a name must go in a path segment:
            ALWAYS APPLY `encodeURIComponent` / `urllib.parse.quote`

    ```ts
    // web-app - canonical builders
    export function itemIconUrl(itemId: number): string {
      return `${API_URL}/osrs-cache/item-icons/${itemId}`;
    }

    const params = new URLSearchParams({ limit: "50", offset: "0" });
    if (search) params.set("search", search);     // encodes "Zamorak's ..." correctly
    apiFetch<OsrsItem[]>(`/osrs-cache/items?${params}`);
    ```

    ```python
    # api-backend / discord-* - never f-string a user term into the path
    resp = await client.get(f"{OSRS_CACHE_SERVICE_URL}/items", params={"search": term})
    ```

    RULE ids_are_ints:
        ALWAYS PASS item_id AS an integer >= 0
        NEVER PASS a name WHERE the route expects an id - resolve it VIA "/items?search=" first

    VALIDATION GATE:
        ✅ no string concatenation of a search term into a URL
        ✅ every query built through URLSearchParams / params=
        ✅ path ids are validated integers

# PHASE 4: CUSTOM RENDERS
    @purpose: "The on-demand renderer, its cost, and when it is the right call"

    `GET /osrs-cache/item-icons/{item_id}/render?size=N`

    Renders the item's 3D `inventory_model` to a flat icon at request time through the
    same pipeline as the baked pass (auto-fit camera, back-face culling, z-buffer,
    two-pass transparency, UV-mapped textures). It is slower than the baked icon and
    is cached for days, not forever.

    | Setting | Value |
    |---|---|
    | `size` default | `512` |
    | `size` range | `32` .. `4096` (proxy-clamped; out of range = 422) |
    | Recommended sizes | `32, 64, 128, 256, 512, 1024, 2048, 4096` |
    | Response format | lossless WebP (`image/webp`) |
    | `Cache-Control` | `no-store` (baked icon: `public, max-age=31536000, immutable`) |
    | `Access-Control-Allow-Origin` | `*` on both image paths |

    RULE render_is_opt_in:
        WHEN the surface is a grid, list, feed, tooltip, or embed:
            ALWAYS USE the baked icon AND SIZE it WITH CSS
        WHEN the user is exporting, downloading, or compositing at a chosen resolution:
            USE "/render?size=N" WITH N FROM the recommended set
        NEVER CALL "/render" IN a loop OVER a whole item list

    RULE handle_the_missing_icon:
        WHEN "/item-icons/{item_id}" RETURNS 404:
            TREAT it AS "this item has no visual model" (noted/placeholder/currency rows)
            RENDER a neutral placeholder
            NEVER FALL BACK TO a third-party image host

    VALIDATION GATE:
        ✅ `/render` calls are user-initiated and single-item
        ✅ requested `size` is inside 32..4096
        ✅ 404 handled as a placeholder, not a Wiki fallback

# PHASE 5: DEFAULTS AND FORMATS
    @purpose: "The values to assume when a caller does not specify"

    | Parameter | Default | Bound |
    |---|---|---|
    | `limit` (items, npcs, objects) | `50` | 1 .. 500 at the proxy (1 .. 200 upstream) |
    | `limit` (sprites) | `100` | 1 .. 500 |
    | `offset` | `0` | >= 0 |
    | `search` | unset (returns the id-ordered page) | substring, case-insensitive |
    | `size` (item render) | `512` | 32 .. 4096 |
    | `format` (sprites) | `png` | `png` \| `webp` |
    | `scale` (sprites) | unset (1x) | 1 .. 32 |

    - Item icons are **always** WebP. Sprites default to PNG and accept WebP.
    - Only the **current** cache build is retained; there is no build history and no
      `build_id` parameter. Read `/osrs-cache/meta` to learn which build is live.
    - Every response is JSON except the image routes, which are raw bytes.

    RULE respect_the_bounds:
        NEVER REQUEST limit > 500
        WHEN a full catalog is needed:
            USE the dedicated bulk route ("/items/names") RATHER THAN paging TO exhaustion

    VALIDATION GATE:
        ✅ no request exceeds a documented bound
        ✅ no caller assumes a build id or a historical build
        ✅ image consumers expect WebP for items

# PHASE 6: VERIFICATION
    @purpose: "Prove the rule holds in the diff, not in intent"

    STEP 1:
        GREP "runescape\.wiki|osrsbox|weirdgloop" IN the change set
        IF a hit is an item or skill icon:
            FAIL "third-party item source"
    STEP 2:
        GREP "osrs-cache-service:8100" IN client-side code
        IF exists:
            FAIL "internal base leaked to a client"
    STEP 3:
        VERIFY every new "/osrs-cache/*" path EXISTS IN openapi_url
    STEP 4:
        WHEN the proxy surface changed:
            EXECUTE "uv run python scripts/generate_openapi.py" IN api-backend
            EXECUTE "bun run gen:api-types" IN web-app
            EXECUTE "./run-tests.sh fast"

    VALIDATION GATE:
        ✅ steps 1-3 clean
        ✅ openapi.json + schema.d.ts regenerated when the surface changed
        ✅ the touched module's suite is green

ALWAYS:
    - SOURCE item definitions, names, and icons FROM /osrs-cache/*
    - ENCODE every dynamic query value
    - DEFAULT TO the baked 512px icon
    - READ /osrs-cache/meta WHEN build freshness matters
    - CONSULT docs_url FOR the live parameter set

NEVER:
    - FETCH an item icon or name FROM a third-party host
    - EXPOSE internal_base TO a browser or a Discord message
    - CONCATENATE an unencoded item name INTO a URL
    - CALL /render ACROSS a list
    - ASSUME a build id, a build history, or an endpoint absent FROM openapi_url
