---
name: commit-scope-means-all-uncommitted
description: "commit ... including prior ones" means every uncommitted change, not just this session's edits
metadata:
  type: feedback
---

When the user says "commit changes, including prior ones," they mean **all
uncommitted work in the tree** (root + every submodule), not just the files this
session touched. Do not narrow scope to your own edits.

**Why:** I committed only the session's rundev/.dockerignore changes and left the
pre-existing web-app app changes, root memory/CLAUDE.md edits, reload.* deletions,
and submodule pointer bumps uncommitted. The user had explicitly said "including
prior ones" and was frustrated by the over-caution.

**How to apply:** On a broad commit request, run `git status` across root and all
submodules, and commit everything dirty - grouped into honest, scoped commits per
repo (web-app app changes in web-app, pointers/root files at root). Only exclude a
change if the user names an exclusion. Commit; do not push unless asked.
