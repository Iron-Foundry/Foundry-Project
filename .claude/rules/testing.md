---
name: testing-policy
description: Tests follow code. Each test pins one behaviour that could break, ships in the same change as its code, and the touched lanes run green through the run lock before done. Enforces CLAUDE.md tests_follow_code.
type: POLICY
domain: [testing, ai-governance]
keywords: [testing, endpoints, interconnects, integration, contract, e2e, run-tests, run-lock, coverage, tests_follow_code]
owner: IronFoundry
created: 2026-07-23
last-verified: 2026-11-20
version: 2
staleness-days: -1
depends-on: [reference_pag_grammar.md, reference_pag_guide.md]
supersedes:
---

> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

THIS POLICY ENFORCES that tests ship in the same change as the code they cover, that each one pins a behaviour that could plausibly break, and that the affected suite runs and passes before work is called done.

**Where it binds:** every module of this monorepo. Every suite a session may run is a row in `collaboration-surface/config/join.config.ts`, and it runs through the run lock, `npm --prefix collaboration-surface run join -- --suite <id>`. `CLAUDE.md` cites this digest under `tests_follow_code`.

%% META %%:
    intent: "Coverage grows with the code, never lags behind it, and never past the point where a test earns its place"
    objective: "No behavioural change merges without its tests in the same change and a green suite, and no test lands that pins nothing which could break"
    context: "Monorepo: api-backend, discord-server, discord-utils, discord-event, osrs-cache-service, web-app and their cross-service interconnects; the runner is root run-tests.sh, reached through the run lock"
    priority: high
    trust: suite_output = TRUSTED, "it should pass" = UNTRUSTED

# PHASE 1: CLASSIFY THE CHANGE
    @purpose: "Determine what was touched and which layers the change obligates"

    RULE pure_logic_obligates_unit:
        WHEN a pure function changes (a transform, a validator, a formatter, a sort, a slug):
            REQUIRE a unit test COVERING the boundary cases, not the happy path alone

    RULE io_obligates_integration:
        WHEN a repository, a migration, Valkey, pubsub, or an external client changes:
            REQUIRE an integration test AGAINST the real store, never a mocked session
        # a mocked session proves the mock, not the query

    RULE surface_obligates_contract:
        WHEN a route, a request schema, a response schema, or a cross-service payload changes:
            REQUIRE an endpoint test AGAINST the real app
            REQUIRE every generated contract TO be regenerated IN the same change (PHASE 5)
        NEVER BUILD a separate app FOR the tests - IMPORT the real factory

    RULE interconnects_obligate_e2e:
        WHEN a change touches web<->api, discord<->api, or api<->runelite:
            REQUIRE a journey under `integration/` that exercises the changed interconnect end to end

    RULE fixes_obligate_a_failing_test_first:
        WHEN fixing a bug:
            WRITE the test that reproduces it BEFORE the fix
            VERIFY it fails FOR the reported reason, then fix

# PHASE 2: WHAT DOES NOT DESERVE A TEST
    @purpose: "An obligated layer says a test is owed - it does not say how many, and the answer is usually one"

    RULE one_test_per_behaviour_not_per_branch:
        ALWAYS WRITE the test AT the boundary where the rule changes its answer
        ALWAYS COVER a vocabulary, a refusal set, or a table OF cases WITH one parametrised test
        NEVER SPLIT one behaviour ACROSS several tests SO the count reads higher

    RULE no_smoke_tests:
        NEVER WRITE a test whose only assertion IS that a module imports, an app constructs,
            a route is registered, a fixture builds, or a request returned 200 WITH the body unread

    RULE dont_test_what_the_type_or_the_framework_guarantees:
        NEVER ASSERT a refusal the type checker OR the validation library already makes
        ALLOW a pinning test WHERE two sources must agree OR where the bound is a product decision

    RULE deleted_features_take_their_tests:
        WHEN a feature, route, column, or rule is deliberately removed:
            DELETE its tests IN the same change

    RULE a_test_names_the_behaviour_it_pins:
        ALWAYS NAME a test FOR the behaviour AND its condition, in at most seven words
        WHEN a good name does not exist: TREAT that AS evidence the test pins nothing

# PHASE 3: AUTHOR TESTS
    @purpose: "What each layer must actually assert"

    RULE assert_behaviour_not_implementation:
        ALWAYS ASSERT the observable result: the returned value, the status, the body, the stored row
        NEVER ASSERT that a function was called, unless the call IS the behaviour

    RULE fixtures_are_explicit_and_isolated:
        ALWAYS BUILD test data IN the test OR a named factory
        NEVER LET one test's rows be another test's precondition

    RULE stub_the_third_party_not_our_code:
        ALWAYS STUB an external host AT the transport layer
        NEVER CALL a live external service FROM the suite
        NEVER STUB our own service OR repository IN an endpoint test

    RULE parity_tests_pin_the_duplicated_pair:
        WHEN a rule is expressed IN two languages: WRITE a parity test ON both sides OVER one shared fixture table

# PHASE 4: RUN AND GATE
    @purpose: "Run the narrowest sufficient scope, and require green before done"

    RULE a_small_change_runs_its_own_tests:
        WHEN a change is small: RUN the test files of what it touched
        RUN the full lane FOR a change across modules, a migration, or a widely imported module

    RULE test_once_at_the_end:
        RUN the suite once, after all the work of a request is done, never between its steps

    RULE green_or_not_done:
        NEVER MARK work done WHILE the relevant suite is red
        NEVER WEAKEN, skip, or delete a failing test TO make the suite green
        WHEN a test fails AND the correct behaviour is a product decision:
            ESCALATE to the operator WITH the failure output AND the two readings

    RULE ci_runs_the_same_command:
        ALWAYS MAKE CI invoke the same suite command the operator runs
        ALWAYS RUN the integration layer AGAINST the real store, never a lighter substitute

# PHASE 5: THIS MONOREPO
    @purpose: "The lanes and the contract artifacts the rules above resolve to here"

    | layer the change obligates | lock suite | lane |
    |---|---|---|
    | every change | `foundry-lint` | ruff check, ruff format --check, pyright per Python module, `tsc --noEmit` for web-app |
    | unit | `foundry-fast` | the suites that need no Docker |
    | integration or contract | `foundry-integration` | the real-infra suites on one shared Postgres and Valkey pair |
    | e2e | `foundry-e2e` | Playwright and discord_e2e on the compose stack |

    RULE the_lane_is_the_narrowest_that_covers:
        IF the change obligates e2e: RUN `foundry-e2e` AFTER `foundry-integration`
        ELSE IF it obligates integration OR contract: RUN `foundry-integration` AFTER `foundry-fast`
        ELSE: RUN `foundry-fast`
        ALWAYS RUN `foundry-lint`

    RULE the_contract_is_regenerated:
        WHEN a route OR a schema changes:
            REGEN `api-backend/openapi.json` WITH `api-backend/scripts/generate_openapi.py`
            REGEN `web-app/src/api/schema.d.ts` WITH `bun run gen:api-types` IN `web-app/`
        WHEN the discord<->api seam changes:
            UPDATE the root `fixtures/` both sides pin to
        NEVER CHANGE one side of a payload without the matching contract test

ALWAYS:
    - SHIP tests in the SAME change as the code they cover
    - WRITE one test per behaviour, at the boundary where that behaviour changes its answer
    - REPRODUCE a bug with a failing test before fixing it
    - RUN every suite through the run lock, once per tree state, and READ its output whole

NEVER:
    - WRITE a smoke test, or test what the type checker already refuses
    - KEEP a test for behaviour that was deliberately removed
    - WEAKEN or delete a failing test to make the suite green
    - MOCK our own service in an endpoint test, or call a live external service from the suite
    - SKIP integration coverage FOR a change that touches Postgres, Valkey, or pubsub
