<!-- Cross-session memory index — loaded into context at session start. One line per memory, no frontmatter, no memory content: just `- [Title](slug.md) — hook`. Facts live in .claude/memory/<slug>.md. Format + rules: ../rules/memory.md -->

# Memory

- [Memory location](memory-location.md) — project memory lives ONLY in repo `.claude/memory/`, never the harness auto-memory path
- [Secrets & startup](secrets-and-startup.md) — Infisical-managed secrets; started via root sh/ps1 scripts; bare docker compose recreates with blank env; both services auto-migrate (`alembic upgrade head`) on container start
- [Cache icon coverage](cache-icon-coverage.md) — cache serves item icons + UI sprites only (no NPC/boss art); how web-app sources item icons/names/skill icons off the Wiki
- [Cache image CORS](cache-image-cors.md) — proxied cache image endpoints must send Access-Control-Allow-Origin:* or cross-origin fetch/canvas loads break
- [Check refs before asking](check-refs-before-asking.md) — ls D:\claude-git-references before asking to clone a reference repo; runelite-repo etc already present
- [Icon render debugging](icon-render-debugging.md) — inspect actual rendered pixels via the fast in-container loop before rebuilding; render camera is clansocket auto-fit, NOT zoom2d
- [OSRS map blank / dead pan-zoom](osrs-map-embed-sizing.md) — dev-only blank + dead pan/zoom was OsrsMap's rAF `rafRef` not nulled on unmount, wedging the loop after StrictMode remount; instrument the loop (drawCanvas never logged) before size/coverage theories
- [No artifacts](no-artifacts.md) — Artifact tool is banned; deliver HTML mockups as a standalone file in the scratchpad and give the path
- [No commit co-author](no-commit-coauthor.md) — never add a Claude/Anthropic Co-Authored-By trailer to commits or PRs; user rejects anything that does
- [Consult before layout changes](consult-before-layout-changes.md) — present plan and get approval before editing any layout/design/styling code; diagnosis is not a license to edit
- [Codeberg push auth retry](codeberg-push-auth-retry.md) — expired-credentials on push is a retryable Codeberg quirk; "could not read Username / prompts disabled" is not, that needs the user to push interactively
- [Never commit without explicit ask](never-commit-without-explicit-ask.md) — never commit/push or even offer to; standing permission doesn't carry to unrelated files noticed later
- [Commit scope means all uncommitted](commit-scope-means-all-uncommitted.md) — "commit ... including prior ones" means every dirty file in root + submodules, not just this session's edits
- [Mirror add/remove features](mirror-add-remove-features.md) — any add-shaped feature needs a matching remove counterpart in the same change, and vice versa
- [Integration testing](integration-testing.md) — layered cross-service tests: api real-infra (`-m integration`), openapi/schema contract, root E2E compose in `integration/`; run via `./run-tests.sh`
- [Lint/typecheck baseline](lint-typecheck-baseline.md) — shared ruff select + pyrightconfig (incl. `reportMissingTypeArgument`) across all 5 Python modules, gated by `./run-tests.sh lint`; ruff `TC*` and `reportPrivateUsage` deliberately excluded
- [No root __init__.py](no-root-init-py.md) — discord-server/discord-event must have NO root `__init__.py`; it makes the root a package with a hyphenated name and trips ruff N999 everywhere
- [Tests follow code](tests-follow-code.md) — STANDARD: new endpoints/interconnects ship with tests in the same change; run touched modules' suites (`./run-tests.sh`) before done (`tests_follow_code`)
- [PAG rulesets](pag-rulesets.md) — repo rulesets authored as PAG POLICY docs in `.claude/rules/` (behavioral.md, testing.md) per `.claude/intel/` grammar; CLAUDE.md one-liners stay the loaded authority
- [API test app instance](api-test-app-instance.md) — importing `conftest._app` in an api-backend test gives a DIFFERENT app than the client fixture, so dependency_overrides silently no-op; use the shared `mock_session` fixture or a header instead
- [Recursive setTimeout over setInterval](recursive-settimeout-over-setinterval.md) — never poll/animate with setInterval; self-scheduling recursive setTimeout avoids tick pileup and drift when work outlasts the interval
- [web-app strict CSP](web-app-strict-csp.md) — prod-server serves enforcing nonce-based CSP; Rocket Loader must stay off, esm.sh + style-src unsafe-inline + youtube/teamup frame-src are required or the site breaks
- [web-app two servers / embed routes](web-app-two-servers-embed-routes.md) — dev (src/index.tsx) and prod (src/prod-server.ts) are separate Bun servers; put all `/embed/*` routes in shared src/embed/routes.ts or they only exist in one
- [web-app prod Dockerfile src allowlist](web-app-prod-dockerfile-src-allowlist.md) — prod image copies a named allowlist of src files, not all of src; a new prod-server value import needs a matching Dockerfile COPY or the container crash-loops "Cannot find module"
- [Reference-data external shapes](reference-data-external-shapes.md) — verified live shapes of the OSRS Wiki drop-table (MediaWiki wikitext + {{DropsLine}}) and WOM /efficiency/rates?type=ironman sources feeding api-backend reference data
