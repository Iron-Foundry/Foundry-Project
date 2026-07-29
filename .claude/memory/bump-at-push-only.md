---
name: bump-at-push-only
description: Version bumps happen once, when unstaged work is about to be pushed - never per component or stage
metadata:
  type: feedback
---

Bump a module's version exactly once, at the point the accumulated unstaged work
is about to be pushed. Never bump per component, per feature, or per stage of a
plan. Between bumps, changelog entries accumulate under one `## [Unreleased]`
heading, which the bump renames to the new version. Committing without bumping
is fine and expected.

**Why:** the user wants changelogs that read as releases, not as a running log of
every part added. A heading per component makes the file useless as a record of
what shipped, and inflates the version number against nothing anyone downstream
can observe. Stated 2026-07-28 after api-backend was bumped to 1.1.0 mid-plan.

**How to apply:** when finishing a unit of work, write the entry under
`## [Unreleased]` and stop. Only run `uv version --bump <level>` when the user
says the work is going out, and then fold `Unreleased` into that version's
heading. Related: [[semver-bump-scope]] still governs which level is yours to
choose - MAJOR is never automatic.
