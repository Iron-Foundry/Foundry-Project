---
name: testing-policy
description: Tests follow code. Every new/changed endpoint, interconnect, repository, or module ships with its tests in the same change; touched modules' suites run and pass before done. Enforces CLAUDE.md tests_follow_code.
type: POLICY
domain: [testing, ai-governance]
keywords: [testing, endpoints, interconnects, integration, contract, e2e, run-tests, coverage, tests_follow_code]
owner: IronFoundry
created: 2026-07-23
last-verified: 2026-07-23
version: 1
staleness-days: -1
depends-on: [reference_pag_grammar.md, reference_pag_guide.md]
supersedes:
---

> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

THIS POLICY ENFORCES that tests accompany every new or changed endpoint, interconnect, repository, or module, and that every touched module's suite runs and passes before the work is considered done.

%% META %%:
    intent: "Coverage grows with the code, never lags behind it"
    objective: "No behavioural change merges without its tests in the same change and a green suite for every touched module"
    context: "Monorepo: api-backend, discord-server, web-app + cross-service interconnects; runner is root ./run-tests.sh"
    priority: high

DECLARE change_set: object
DECLARE touched_modules: array
DECLARE required_test_layers: array
DECLARE run_scope: string

SET touched_modules = []
SET required_test_layers = []
SET run_scope = "none"

# PHASE 1: CLASSIFY CHANGE
    @purpose: "Determine what was touched and which test layers the change obligates"

    ANALYZE change_set FOR touched_modules
    ANALYZE change_set FOR change_kinds
    # WHICH layers to run is derived below; WHAT each layer must assert is derived
    # from `.claude/intel/reference_test_surface_coverage.md` (surface x lens -> invariant)

    FOR EACH change IN change_set.changes:
        IF change.kind IN ["endpoint", "router", "component", "hook", "pure_function"]:
            APPEND "unit" TO required_test_layers
        IF change.touches IN ["postgres", "valkey", "pubsub", "repository", "migration"]:
            APPEND "integration" TO required_test_layers
        IF change.kind == "cross_service_payload" OR change.touches == "response_schema":
            APPEND "contract" TO required_test_layers
        IF change.touches IN ["web<->api", "discord<->api", "api<->runelite"]:
            APPEND "e2e" TO required_test_layers

    VALIDATION GATE:
        ✅ touched_modules enumerated from the actual diff
        ✅ required_test_layers derived from change kinds, not assumed
        ✅ a runtime-behaviour change yields at least "unit"
        ✅ any DB/Valkey/pubsub touch yields "integration"

# PHASE 2: AUTHOR TESTS
    @purpose: "Ensure each obligated layer has a real test in THIS change before running anything"

    FOR EACH layer IN required_test_layers:
        MATCH layer:
            CASE "unit":
                VERIFY mocked endpoint / component / function test EXISTS AND asserts behaviour
            CASE "integration":
                VERIFY test under integration marker EXISTS AND asserts real persistence, not mock calls
            CASE "contract":
                REGEN "api-backend/openapi.json" USING scripts/generate_openapi.py
                REGEN web "src/api/schema.d.ts" USING "bun run gen:api-types"
                UPDATE root "fixtures/" FOR the discord<->api seam
                VERIFY contract test covers the changed payload/path
            CASE "e2e":
                VERIFY journey under integration/ exercises the changed interconnect end to end

    VALIDATION GATE:
        ✅ every required layer has a corresponding test in this change
        ✅ integration tests assert real DB/Valkey/pubsub state
        ✅ contract artifacts regenerated when a schema/payload changed
        ✅ no test deferred to a later change

# PHASE 3: RUN AND GATE
    @purpose: "Run the narrowest sufficient scope via the standard runner and require green before done"

    IF required_test_layers CONTAINS "e2e":
        SET run_scope = "all"
    ELSE IF required_test_layers CONTAINS "integration" OR required_test_layers CONTAINS "contract":
        SET run_scope = "integration"
    ELSE:
        SET run_scope = "fast"

    BASH "./run-tests.sh " + run_scope INTO run_result

    IF run_result.failures > 0:
        REPORT run_result.failing_suites
        REPORT "PAUSE_FOR_USER"

    VALIDATION GATE:
        ✅ run_scope is the narrowest that covers required_test_layers
        ✅ ./run-tests.sh executed for every touched module's scope
        ✅ run_result.failures == 0
        ✅ work is only "done" once the selected scope is green

ALWAYS:
    - SHIP tests in the SAME change as the code they cover
    - ASSERT real state in integration tests, never mock-call counts
    - REGEN openapi.json + schema.d.ts WHEN a cross-service payload/schema changes
    - RUN ./run-tests.sh for every touched module's scope BEFORE declaring done
    - ESCALATE to the user WHEN a suite fails and the fix is a product decision

NEVER:
    - DEFER a test to a later change ("I'll add tests after")
    - WEAKEN or delete a failing test to make the suite green
    - MARK work done WHILE the selected run_scope is red
    - ADD an unused endpoint/route with no consumer just to satisfy a test
    - SKIP integration coverage FOR a change that touches Postgres, Valkey, or pubsub

WHEN change touches a cross-service interconnect (web<->api, discord<->api, api<->runelite):
    ALWAYS:
        - UPDATE the contract fixture/artifact both sides pin to
        - RUN ./run-tests.sh e2e against the real stack
    NEVER:
        - CHANGE one side of a payload without the matching contract test
