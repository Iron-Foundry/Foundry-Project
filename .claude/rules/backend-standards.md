# Backend standards

> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

THIS POLICY ENFORCES that every service a session writes is typed, validated at its edge, versioned through one manifest, covered by its suite, and reachable from one entry point per job - with no shortcut, no shim, and no second way to do anything.

**Where it binds:** any server, API, worker or command-line pass, in any language. The examples name no framework on purpose: the rule is the shape, and each stack supplies its own model, settings and migration tools. `CLAUDE.md` cites this digest under `services_are_built_to_one_standard`.

# PHASE 1: BOUNDARIES ARE MODELS
    @purpose: "Nothing crosses a boundary as an untyped bag, and nothing crosses one having quietly failed"

    RULE validated_model_at_every_edge:
        WHEN data enters OR leaves the process (an HTTP body, a query, the environment, an external API, a file, a queue):
            ALWAYS DECLARE it AS a validated model WITH constrained fields
            NEVER ACCEPT a bare map of strings to anything, OR an unparsed response body
        ALWAYS REFUSE an unknown field ON a request OR a config model
        # a silently-dropped unknown field is a bug the client cannot see

    RULE three_model_kinds_stay_apart:
        ALWAYS SEPARATE the storage model, the wire schema, AND the domain value
        NEVER RETURN a storage row FROM a route, NEVER PERSIST a request schema directly

    RULE settings_are_one_model:
        # root: env_only_secrets
        ALWAYS READ configuration THROUGH one settings model
        NEVER READ the environment OUTSIDE that model
        NEVER DEFAULT a secret; a missing secret MUST fail at startup

    RULE external_hosts_named_once:
        ALWAYS NAME an external host IN exactly one module, its base address FROM settings
        ALWAYS PARSE its response INTO a model BEFORE the value reaches domain code

    RULE fail_at_startup_not_at_first_use:
        # root: no_env_fallback
        ALWAYS VALIDATE configuration, required secrets, and reachability AT startup
        NEVER SUPPLY a fallback FOR a value whose absence is a deployment mistake

    RULE raise_never_silence:
        ALWAYS LET an error propagate TO the single boundary that translates it
        NEVER CATCH an exception ONLY to log it AND continue
        NEVER RETURN an empty value IN place of a failure
        NEVER RETRY INTO a shrug: a retry that exhausts MUST raise
        WHEN a failure IS genuinely recoverable: CATCH the narrowest type AND SAY why

    RULE absent_is_not_failed:
        ALWAYS EMIT null FOR "there is no value" AND an error FOR "we could not get the value"
        NEVER EMIT 0 FOR a figure the source has not supplied

# PHASE 2: STRUCTURE AND REUSE
    @purpose: "One home per concept, and the second implementation of anything is a defect"

    RULE feature_slices_not_layer_buckets:
        # root: filesystem_is_the_architecture
        ALWAYS PLACE a feature's models, schemas, repository, service and routes TOGETHER IN its slice
        NEVER CREATE a top-level bucket holding every feature, OR a `utils` / `helpers` / `common` module

    RULE one_direction_only:
        ENFORCE routes -> service -> repository -> storage models
        NEVER LET a service import another slice's repository - use its service or a plain-value lookup

    RULE one_error_shape:
        ALWAYS RAISE a domain error FROM the service AND translate it IN one handler
        ALWAYS EMIT the same problem body FOR every failure

# PHASE 3: PERSISTENCE
    @purpose: "The schema is migrated, not guessed, and the query is bounded"

    RULE migrations_own_the_schema:
        ALWAYS EXPRESS a schema change AS a migration IN the same change AS the model, WITH a real downgrade
        ALWAYS KEEP a single migration head
        NEVER EDIT an applied migration - add a new one

    RULE queries_are_bounded_and_explicit:
        ALWAYS PAGINATE a collection endpoint WITH a bounded, declared limit
        ALWAYS LOAD a relationship explicitly
        NEVER ISSUE a query INSIDE a loop over rows
        ALWAYS INDEX a column a query filters, sorts, or joins on, IN the same migration

    RULE time_is_utc_on_the_wire:
        ALWAYS STORE a timestamp WITH its zone, IN UTC, AND EMIT it AS ISO 8601
        NEVER FORMAT a date server-side FOR display

# PHASE 4: THE CONTRACT
    @purpose: "One wire contract, generated in one direction, never hand-mirrored"

    RULE every_route_carries_a_version_prefix:
        ALWAYS MOUNT a domain route UNDER a version prefix such as `/api/v1`
        NEVER SERVE one resource AT both a versioned and an unversioned path
        WHEN a change would break a consumer: MOUNT the new shape AT the next version AND KEEP the old one serving

    RULE the_contract_is_generated:
        ALWAYS COMMIT the generated API document AND regenerate it IN the change that alters a route or schema
        ALWAYS GENERATE client types FROM it - never hand-maintain a mirror

    RULE the_api_returns_data_not_display_strings:
        NEVER RETURN "5.4k", "12 hours ago", or a locale-formatted number FROM an endpoint

# PHASE 5: VERSION, DEPENDENCIES, SETTINGS
    @purpose: "One version, deliberate dependencies, every setting in every template"

    RULE the_manifest_is_the_only_version:
        ALWAYS KEEP the version IN the package manifest alone AND move it THROUGH the package tool
        NEVER BUMP the version UNLESS the operator asks; PATCH is the default bump; MAJOR is never yours

    RULE dependencies_are_deliberate:
        ALWAYS STATE what a new dependency buys AND what it replaces
        NEVER ADD one FOR a function you could write IN under thirty lines

    RULE config_lands_in_every_template:
        WHEN a new setting appears: SHIP its line IN every environment template IN the same change

    RULE one_entry_point_per_job:
        ALWAYS EXPOSE lint, typecheck, test, migrate, run AND deploy AS one command each, AND MAKE CI call those commands

# PHASE 6: DEPLOYMENT
    @purpose: "Production is the operator's"

    RULE production_is_the_operators:
        NEVER CONNECT to a production host, pull, rebuild, restart OR purge a cache
        VERIFY the fix locally, HAND OVER the exact commands, AND VERIFY the live result afterwards

    RULE a_deploy_checklist_names_every_setting:
        WHEN a deployment checklist is written: LIST every setting a new or changed service reads, an assumed one marked AS assumed

    RULE a_deploy_break_gets_a_gate:
        WHEN a fault shows only in production: SHIP a local test that reproduces it IN the same fix

    RULE a_version_sha_proves_no_deploy:
        PROVE a change is live BY its behaviour ON the live service, never BY a version string

ALWAYS:
    - FAIL at startup on a missing invariant, and RAISE rather than silence at runtime
    - MODEL every boundary with real constraints
    - SHIP the migration and the regenerated contract with the code

NEVER:
    - SWALLOW an exception, or return a default in place of a failure
    - CREATE a grab-bag module or a second implementation of an existing transform
    - HAND-EDIT a version, a generated contract, or a generated type file
    - SILENCE a gate instead of fixing what it caught
