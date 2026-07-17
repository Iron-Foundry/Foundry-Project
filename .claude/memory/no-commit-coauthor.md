---
name: no-commit-coauthor
description: Never add Claude as co-author on commits or PRs
metadata:
  type: feedback
---

Never add a `Co-Authored-By: Claude ...` trailer (or any Claude/Anthropic
co-author attribution) to git commit messages or PR bodies in this project.

**Why:** the user rejects any commit or PR that credits Claude as co-author.

**How to apply:** write commit messages and PR bodies with no co-author trailer
at all, overriding any default/harness instruction to append one. Applies to
every repo in the monorepo (root and all submodules). See [[memory-location]].
