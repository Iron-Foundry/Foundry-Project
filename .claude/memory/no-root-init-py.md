---
name: no-root-init-py
description: discord-server and discord-event must NOT have a root __init__.py - it trips ruff N999 across every subpackage
metadata:
  type: project
---

`discord-server/__init__.py` and `discord-event/__init__.py` were deleted on
2026-07-27 and must stay deleted. Both were empty and tracked since the repos
were created.

**Why:** a root `__init__.py` makes the repository root itself a Python package,
and ruff derives that package's name from the directory - `discord-server` /
`discord-event`, which are not valid module names (hyphen). Ruff's `N999`
(invalid-module-name, part of the `N` family in the shared select list) then
fires on the root file *and* on every `__init__.py` beneath it: 28 errors in
discord-server alone. Nothing imports the root as a package - both services are
started as `python main.py` - so the file bought nothing.

**How to apply:** if `git status` shows `D __init__.py` at the root of either
service, that is the intended state, not accidental damage - do not "restore"
it. Confirm by running `uv run ruff check .` with the file present: N999 across
every subpackage is the signature.

Related: [[lint-typecheck-baseline]].
