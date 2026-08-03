> PAG (Pattern Abstract Grammar) is Bane's Lab IP, used under CC BY-SA.

THIS POLICY ENFORCES that every module's version moves exactly once per push, at a level Claude is allowed to choose, through the module's own tooling, with the changelog and every derived artifact carried along.

%% META %%:
    intent: "One version move per push, never a MAJOR without the maintainer, never a move for work that ships no behaviour"
    objective: "The number in the manifest, the CHANGELOG heading, and every generated artifact that embeds the version agree at all times"
    context: "Monorepo of independently versioned submodules; each manifest is the single source its runtime and CI read"
    criteria: "A reviewer can tell from the diff alone which level was chosen and why, and no second bump appears in the same push"
    priority: high
    trust: manifest = AUTHORITATIVE, hand_edited_version = FORBIDDEN, maintainer = SOLE_MAJOR_AUTHORITY

DECLARE change_kinds: array
DECLARE bump_level: string
DECLARE bump_tool: string
DECLARE derived_artifacts: array

SET bump_level = "none"
SET derived_artifacts = []

# PHASE 1: DOES IT BUMP AT ALL
    @purpose: "A version is a promise to consumers - work no consumer can observe makes no promise"

    RULE ships_behaviour_or_it_does_not_bump:
        WHEN the change is confined TO the test suite or its harness
             (tests, fixtures, conftest, runners, flake fixes):
            SET bump_level = "none"
            # nothing reaches a consumer, so there is nothing to version
        WHEN the change is confined TO documentation, CHANGELOG prose, or CI config:
            SET bump_level = "none"
        ELSE:
            CONTINUE TO PHASE 2

    RULE the_entry_still_gets_written:
        WHEN bump_level == "none" AND the change is worth recording:
            APPEND the entry UNDER "## [Unreleased]"
            # the next real bump renames that heading; the note is never lost

    VALIDATION GATE:
        ✅ a test-only or docs-only change carries no manifest diff
        ✅ a behavioural change is classified as bumping before a level is picked
        ✅ any skipped bump still left its "## [Unreleased]" entry

# PHASE 2: PICK THE LEVEL
    @purpose: "Which levels Claude may choose alone, and which belong to the maintainer"

    RULE claude_picks_up_to_minor:
        ALWAYS CHOOSE among PATCH, MINOR, and the prerelease tags (alpha, beta, rc) WITHOUT asking
        NEVER CHOOSE MAJOR
        WHEN the change looks genuinely breaking:
            MAKE the change
            LEAVE the version alone
            REPORT "a major bump looks due" WITH the reason
            # release readiness is a product signal, not a consequence of a diff

    RULE breaking_is_measured_by_consumers:
        WHEN deciding whether a surface change is breaking:
            ANALYZE who actually calls it, NOT whether it appears IN a generated schema
        WHEN the only consumer is our own frontend AND both sides ship together:
            TREAT it AS MINOR
        WHEN the consumer is unauthenticated, an external client, or a pinned cross-service contract:
            RAISE the major-bump flag TO the user

    VALIDATION GATE:
        ✅ the chosen level is PATCH, MINOR, or a prerelease tag
        ✅ no MAJOR bump was made without the user saying so in this turn
        ✅ a suspected breaking change was reported rather than silently bumped

# PHASE 3: MOVE IT THROUGH THE MODULE'S OWN TOOL
    @purpose: "The manifest is generated state - editing it by hand desynchronises the lock and skips validation"

    | Module kind | Manifest | Command |
    |---|---|---|
    | Python (uv) | `pyproject.toml` | `uv version --bump patch\|minor\|alpha\|beta\|rc` |
    | Python, drop a prerelease tag | `pyproject.toml` | `uv version --bump stable` |
    | Node (web-app) | `package.json` | `npm version --no-git-tag-version <level>` |

    RULE never_hand_edit_the_manifest:
        ALWAYS RUN the module's own command
        NEVER EDIT the `version` field directly
        NEVER PASS an explicit version string WHERE a `--bump` level expresses the intent
        # the exception is undoing a bump that should not have happened, where the
        # target number is the only thing that expresses the intent

    RULE carry_the_derived_artifacts:
        WHEN the module embeds its version IN a generated file:
            REGENERATE that file IN the same change
            APPEND it TO derived_artifacts
        # api-backend: pyproject.toml -> app/version.py -> GET /version AND the
        # openapi.json `info.version` block, so a bump requires
        # `uv run python scripts/generate_openapi.py`

    VALIDATION GATE:
        ✅ the manifest diff was produced by the tool, not by hand
        ✅ the lockfile moved with the manifest where the tool maintains one
        ✅ every generated artifact embedding the version was regenerated

# PHASE 4: TIMING AND THE CHANGELOG
    @purpose: "One move per push, and one heading the accumulated work lands under"

    RULE bump_once_at_push:
        BUMP exactly once, WHEN the accumulated work is about TO be pushed
        NEVER BUMP per component, per feature, or per stage
        NEVER OPEN a new version heading per addition

    RULE the_unreleased_heading_is_the_only_staging_area:
        WHILE work accumulates:
            WRITE every entry UNDER a single "## [Unreleased]" heading
        WHEN the bump happens:
            RENAME that heading TO "## [<new_version>] - <YYYY-MM-DD>"
        # Keep a Changelog format; sections are Added / Changed / Fixed / Removed

    RULE the_entry_states_the_defect_not_the_patch:
        ALWAYS WRITE what was wrong AND what a consumer now sees
        NEVER WRITE a changelog of the file's own history ("was X, now Y")

    VALIDATION GATE:
        ✅ exactly one version heading was created by this push
        ✅ no "## [Unreleased]" heading survives a bump
        ✅ the dated heading matches the manifest number exactly

# PHASE 5: VERIFICATION
    @purpose: "Prove it in the diff and against the gate that will judge it"

    STEP 1:
        EXECUTE "git status --short" IN the module
        VERIFY the manifest, its lockfile, CHANGELOG.md, and derived_artifacts moved together
    STEP 2:
        VERIFY the CHANGELOG's top version heading EQUALS the manifest version
    STEP 3:
        GREP the diff FOR a second version heading
        IF exists:
            FAIL "more than one bump in a single push"

    RULE the_ci_gate_and_this_policy_disagree_about_tests:
        # Each module's `.github/workflows/test.yml` has a `version` job that fails a
        # pull request when shipped code changed without a manifest bump. Its
        # exemption pattern is `^(\.github/|.*\.md)$` - docs and CI only.
        WHEN a pull request changes ONLY test files:
            EXPECT the gate TO demand a bump THAT this policy forbids
            REPORT the conflict TO the user
            NEVER BUMP just TO satisfy the gate
            NEVER DISABLE or skip the gate WITHOUT the user's approval
        # the gate runs on pull_request only, so a direct push to main is unaffected

    VALIDATION GATE:
        ✅ steps 1-3 clean
        ✅ a test-only PR's gate conflict was reported, not bumped around
        ✅ no gate was disabled or bypassed

ALWAYS:
    - CHOOSE the level yourself up to MINOR, and prerelease tags freely
    - MOVE the version through `uv version` / `npm version`, never by hand
    - REGENERATE every artifact that embeds the version
    - BUMP once, at push, with the accumulated entries under one heading
    - LEAVE the version untouched WHEN only tests, docs, or CI changed

NEVER:
    - BUMP MAJOR on your own initiative - report that one is due and stop there
    - BUMP for a change no consumer can observe
    - EDIT `version` in pyproject.toml or package.json directly
    - OPEN a second version heading in the same push
    - TREAT a generated schema's contents as the definition of "breaking"
