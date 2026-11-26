> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

THIS POLICY ENFORCES that every OSRS item, NPC, sprite, name and loot rate an Iron Foundry surface shows comes from the OSRSClans API, read through api-backend for data and loaded straight from OSRSClans for images.

%% META %%:
    intent: "One maintained source of OSRS data and art, with no second copy in Foundry"
    objective: "No surface ships OSRS data or an item, NPC or sprite image from anywhere but OSRSClans"
    context: "OSRSClans serves its own baked game cache and Wiki drop tables; api-backend reads it through app/services/osrsclans/ (one Valkey copy per query for an hour) and serves it under /reference/*"
    criteria: "Every OSRS data read goes through /reference/*, every OSRS image URL is an OSRSClans image route, and every query is built with URLSearchParams or httpx params="
    priority: high
    trust: osrsclans = AUTHORITATIVE, third_party_item_host = FORBIDDEN, wiki_art = PERMITTED_EXCEPTION

DECLARE osrsclans_api: string
DECLARE api_base: string
DECLARE osrsclans_spec: string

SET osrsclans_api = "https://osrsclans.cc/api/v1"
SET api_base = "https://api.ironfoundry.cc"          # local development: http://localhost:8000
SET osrsclans_spec = "https://osrsclans.cc/openapi.json"

# PHASE 1: SOURCE SELECTION
    @purpose: "Decide where an OSRS value comes from before a single URL is written"

    RULE osrsclans_is_the_source:
        WHEN a surface needs an item, an NPC, a sprite, a name map, a drop table or a kill rate:
            ALWAYS READ the data FROM api_base + "/reference/..."
            ALWAYS LOAD the image FROM osrsclans_api + "/osrs/{items|npcs|sprites}/{id}.webp"
            NEVER FETCH it FROM prices.runescape.wiki item images, osrsbox, chisel.weirdgloop.org, or any other third-party item host
            NEVER RE-HOST a copy in the repo, an S3 bucket, or a hardcoded id -> URL table

    RULE data_goes_through_api_backend:
        ALWAYS CALL OSRSClans data routes FROM api-backend, through app/services/osrsclans/client.py
        # one cached copy per query; a browser never calls an OSRSClans data route
        ALLOW the browser TO load OSRSClans IMAGES directly
        # OSRSClans sends CORS * on its image routes, and the web-app CSP lists it in connect-src for downloads

    RULE check_the_live_spec_first:
        WHEN OSRSClans seems to lack a route or a value:
            ALWAYS READ osrsclans_spec AND one sample request BEFORE working around it
            # its gaps are being closed

    RULE permitted_exception_wiki_art:
        WHEN the asset is boss or activity artwork OSRSClans has no still for, or a wiki page summary:
            ALLOW the OSRS Wiki AS the source
        WHEN the asset is an item icon, an NPC still OSRSClans serves, or a skill icon:
            NEVER FALL BACK TO the Wiki

    VALIDATION GATE:
        ✅ every new OSRS data read goes through /reference/*
        ✅ every new OSRS image URL is an OSRSClans image route
        ✅ no third-party item host appears in the diff
        ✅ any Wiki URL in the diff is artwork OSRSClans does not serve

# PHASE 2: ROUTES
    @purpose: "The read-only surface api-backend serves. All GET, all unauthenticated"

    | Route | Returns | OSRSClans source |
    |---|---|---|
    | `GET /reference/osrs/items?search=&limit=&offset=` | `ItemOut[]` | `/osrs/items`, `/osrs/items/search` |
    | `GET /reference/osrs/items/names` | `{ "<item_id>": "<name>" }` | `/osrs/items/names` |
    | `GET /reference/osrs/items/{item_id}` | `ItemOut` | `/osrs/items/{id}` |
    | `GET /reference/osrs/items/{item_id}/variants` | `ItemOut[]` | the item's noted, placeholder and stack forms |
    | `GET /reference/osrs/npcs?q=` | `OsrsNpcPage` | `/osrs/npcs/search` |
    | `GET /reference/osrs/sprites?q=` | `OsrsSpritePage` | `/osrs/sprites/search` |
    | `GET /reference/osrs/sprite-frames?search=&category=` | `SpriteFramePage` | `/osrs/sprites`, `/osrs/sprites/search` |
    | `GET /reference/osrs/sprites/categories` | `SpriteCategoryOut[]` | `/osrs/sprites/categories` |
    | `GET /reference/loot-rates`, `/reference/loot-rates/sources` | loot rate pages | `/loot-rates`, `/loot-rates/sources` |

    RULE bulk_names_once:
        ALWAYS FETCH "/reference/osrs/items/names" ONCE per session AND cache it in memory
        NEVER LOOK UP a name per row in a list

    RULE one_query_one_request:
        NEVER CALL an OSRSClans route per row
        # an item's variants come from the item itself, never one fetch per form

    VALIDATION GATE:
        ✅ list surfaces use the bulk name map
        ✅ no OSRSClans call runs inside a loop over rows
        ✅ no route outside this table is invented for OSRS data

# PHASE 3: URL CONSTRUCTION AND ENCODING
    @purpose: "Names carry spaces, apostrophes, parentheses and #; unencoded they corrupt the query"

    RULE encode_every_dynamic_segment:
        ALWAYS BUILD query strings WITH `URLSearchParams` (TypeScript) OR httpx `params=` (Python)
        NEVER CONCATENATE a raw name or source key INTO a URL
        WHEN a value must go in a path segment:
            ALWAYS APPLY `encodeURIComponent` / `urllib.parse.quote`

    ```ts
    // web-app - the image builders live in src/api/osrsAssets.ts
    itemImageUrl(4151)            // https://osrsclans.cc/api/v1/osrs/items/4151.webp
    spriteImageUrl(197, 0, "4")   // https://osrsclans.cc/api/v1/osrs/sprites/197.webp?frame=0&scale=4
    ```

    RULE ids_are_ints:
        ALWAYS PASS an id AS an integer in 0 .. 16777215
        NEVER PASS a name WHERE the route expects an id

    VALIDATION GATE:
        ✅ no string concatenation of a search term into a URL
        ✅ every query built through URLSearchParams / params=
        ✅ path ids are validated integers

# PHASE 4: IMAGE SIZES
    @purpose: "OSRSClans serves fixed scales; there is no render at an arbitrary size"

    | Image | Scales | Default |
    |---|---|---|
    | item | `1` (36 x 32), `2`, `4`, `8`, `max` (512 x 455) | `max` |
    | sprite | `1`, `2`, `4`, `8`, `16`, `max`, style `classic` or `upscaled` | `1` |
    | NPC | one still | - |

    RULE size_with_css:
        WHEN the surface is a grid, list, feed, tooltip or embed:
            ALWAYS USE the default image AND SIZE it WITH CSS
        WHEN the user downloads an image at a chosen size:
            USE a `scale` FROM the table above

    RULE handle_the_missing_image:
        WHEN an OSRSClans image answers 404:
            RENDER a neutral placeholder
            NEVER FALL BACK TO a third-party image host

    VALIDATION GATE:
        ✅ only the scales above are requested
        ✅ a 404 is handled as a placeholder, not a fallback host

ALWAYS:
    - READ OSRS data through /reference/* and load OSRS images from OSRSClans
    - ENCODE every dynamic query value
    - CHECK the live OSRSClans spec before working around a gap

NEVER:
    - FETCH an item, NPC or sprite image or name FROM a third-party host
    - CALL an OSRSClans data route from the browser
    - CALL OSRSClans once per row
    - CONCATENATE an unencoded name INTO a URL
