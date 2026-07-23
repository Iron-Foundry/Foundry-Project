---
name: tests-follow-code
description: Standing standard - new endpoints/interconnects ship with tests; run touched modules' suites before done
metadata:
  type: feedback
---

Testing is a standing standard, not a one-off (user, 2026-07-22): every new or
changed endpoint, router, repository, or cross-service interconnect must ship
with its tests in the SAME change, and the affected module's suite must be run
before the work is considered done.

**Why:** the user wants coverage to grow with the code, not lag behind it. The
mocked api suite gives false confidence (it mocks DB/Valkey), so real seams need
real-infra tests; cross-service payloads drift silently without contract tests.

**How to apply:**
- Mocked endpoint/unit test: always, for any new endpoint/component/function.
- Real-infra integration test (`-m integration`): when the change touches
  Postgres, Valkey, or pubsub - assert real persistence, not mock calls.
- Contract test: when a cross-service payload/schema changes - regen
  `api-backend/openapi.json` (`scripts/generate_openapi.py`) and web
  `schema.d.ts` (`bun run gen:api-types`); update root `fixtures/` for the
  discord<->api seam.
- E2E: when the web<->api / discord<->api / api<->runelite interconnect changes.
- Run via root `./run-tests.sh {fast|integration|e2e|all}` before done -
  `fast` minimum for any runtime change, escalate by what was touched.

Codified as CLAUDE.md rule `tests_follow_code` and as a PAG POLICY ruleset at
`.claude/rules/testing.md` (authored per the `.claude/intel/` PAG grammar -
POLICY type, phase-gated, ALWAYS/NEVER + WHEN blocks). Full test-suite layout
and commands: [[integration-testing]].
