---
name: root-launcher
description: ./run is the single root entry point for run/test/maintenance jobs; the run*.sh|ps1 pairs are gone
metadata:
  type: project
---

The repo root carries one launcher instead of eight loose scripts: `./run` (POSIX
shim) and `.\run.ps1` (Windows shim), both handing `scripts/run.py` to `uv`, which
resolves the script's PEP 723 dependency (Textual) on first run. Bare invocation
opens a menu; `./run <action> [choice] [--flag] [-- extra]` runs one directly, and
`--print` resolves the commands without running them. The catalog lives in
`scripts/launcher/catalog.py`.

`rundev.sh|ps1`, `runprod.sh|ps1` and `runstaging.sh|ps1` were deleted on
2026-08-03; their infisical + docker compose invocations are now Python in
`scripts/launcher/stack.py` (actions `dev`, `staging`, `prod`). `run-tests.ps1`
moved to `scripts/run-tests.ps1`; `run-tests.sh` stays at the root because CI
(`.github/workflows/e2e.yml`) and the rulesets pin `./run-tests.sh`.

**Why:** the root was the project's front door and eight near-duplicate `.sh`/`.ps1`
files made it unreadable and let the two platforms drift apart. One catalog with
per-platform dispatch removes the duplication without rewriting the tuned bash.
The name is `run`, not an invented product name - the user rejected `foundry`, and
`./scripts` was impossible (it collides with the `scripts/` directory).

Because uv runs the launcher inside its own script environment, `runner.py` strips
`VIRTUAL_ENV` (and `UV_INTERNAL__PARENT_INTERPRETER`) from every child - without it
each nested `uv run` warns that VIRTUAL_ENV does not match the module's own `.venv`,
once per test step. Anything else the launcher's environment gains belongs on that
same blocklist.

**How to apply:** add a new job as an `Action` in `catalog.py`, not as another root
script. The menu only chooses - it exits before the command starts, so the job gets
a real TTY. On Windows the catalog prefers a script's `.ps1` twin; elsewhere the
`.sh`. See [[secrets-and-startup]] and [[integration-testing]].
