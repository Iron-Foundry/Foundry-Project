# Migration back to GitHub

Codeberg has blocked pushes from this account under its AI-generated-code
policy. All six repositories move back to the `Iron-Foundry` GitHub
organisation, where they still exist from before the June 2026 move.

## Position (verified 2026-07-31)

| Repo | GitHub | Local ahead | Codeberg-only commits |
|---|---|---|---|
| Foundry-Project (root) | exists, public, `main`, pushed 2026-06-20 | 58 | 0 |
| api-backend | exists, public, `main`, pushed 2026-06-20 | 50 | 0 |
| web-app | exists, public, `main`, pushed 2026-06-20 | 63 | 0 |
| discord-server | exists, public, `main`, pushed 2026-06-15 | 18 | 0 |
| discord-utils | exists, public, `main`, pushed 2026-05-03 | 14 | 0 |
| discord-event | exists, public, `main`, pushed 2026-05-03 | 8 | 0 |

Every GitHub tip is an ancestor of the local `main`, and `main..origin/main` is
empty everywhere, so:

- the restore is a **fast-forward push**; no rewrite, no `--force`, no `--mirror`
- **nothing is stranded on Codeberg** - every commit the blocked remote holds is
  already in the local clones

Codeberg refuses git smart-HTTP from this network at the edge (`403` with a
3-byte `Bye` body on `/info/refs`, authenticated or not, while HTML pages and
`/api/v1/version` return `200`). GitHub git-HTTPS from the same host works.

Also migrating: `discord-server` local branch `survey`, and the pending work
already committed locally (`a829e6f` api-backend, `d9ea0d7` web-app, `290ec8e`
root) plus the five submodules' earlier unpushed docs commits.

## Stage 0 - authentication (blocks everything)

`gh` is not installed and no GitHub credential is stored.

1. User installs and authenticates: `sudo pacman -S github-cli && gh auth login`
   (HTTPS, "authenticate git with your GitHub credentials" = yes).
2. Verify: `gh auth status` and `git ls-remote https://github.com/Iron-Foundry/api-backend.git`.

Gate: `gh auth status` clean before Stage 1.

## Stage 1 - restore GitHub as origin

Per repo (root + five submodules):

1. `git remote set-url origin https://github.com/Iron-Foundry/<repo>.git`
2. Keep the dead Codeberg URL as an archive remote: `git remote add codeberg <old-url>`
3. `git push origin main` - fast-forward, no force
4. `git push origin survey` in `discord-server`

Then in the root:

5. `.gitmodules` URLs back to `https://github.com/Iron-Foundry/<repo>.git`
6. `git submodule sync --recursive` so `.git/modules/*/config` follows
7. Commit the `.gitmodules` change and the submodule pointer bumps together
   (CI is not yet ported, so the pointers are advanced by hand this once)

Gate: `git ls-remote origin main` on each repo matches local `HEAD`.

## Stage 2 - port CI to GitHub Actions

Move `.forgejo/workflows/` to `.github/workflows/` in all six repos, then:

| Change | Where | Detail |
|---|---|---|
| Runner labels | every job | `codeberg-small` / `codeberg-tiny` -> `ubuntu-latest` |
| `permissions:` | every workflow | Forgejo ignored this key ([[forgejo-no-permissions-key]]); GitHub honours it. Add least-privilege blocks - `contents: read` default, `contents: write` on the submodule-bump job |
| Dispatch API | `notify-parent.yml` x5 | `codeberg.org/api/v1/repos/.../dispatches` -> `https://api.github.com/repos/Iron-Foundry/Foundry-Project/dispatches`, `Authorization: Bearer`, `Accept: application/vnd.github+json`, body `{"event_type":"submodule-updated","client_payload":{"submodule":"<name>"}}` |
| Bot identity | `update-submodules.yml` | `forgejo-actions[bot]@noreply.codeberg.org` -> `github-actions[bot]@users.noreply.github.com` |
| E2E | `e2e.yml` | Replace the `services:` + `nohup` stack with `./run-tests.sh e2e` (compose-based). GitHub runners have a Docker socket, which is the only reason the workaround existed - this removes the CI/local drift |
| Secret | org or repo | Recreate `SUBMODULE_PAT` as a GitHub fine-grained PAT with `contents: write` on `Foundry-Project`, set on all five submodule repos |

Delete `.forgejo/` once each port is green.

Gate: a push to a submodule triggers `notify-parent`, which dispatches to the
root, which advances the pointer and pushes - the loop that keeps the root
repo's pointers current.

## Stage 3 - documentation and memory sweep

Files carrying Codeberg facts:

- `README.md` - org link, per-repo table (5 rows), clone command, "CI/CD:
  Forgejo Actions (Codeberg runners)" row
- `CLAUDE.md` line 101 - the IronFoundry-on-Codeberg sentence in `# PROJECT`
- `.gitmodules` - done in Stage 1
- `.claude/memory/codeberg-push-auth-retry.md` - obsolete; replace with the
  GitHub auth reality, and record the Codeberg block so no future session
  retries it
- `.claude/memory/forgejo-no-permissions-key.md` - inverts on GitHub; rewrite as
  a GitHub Actions `permissions:` note or delete
- `.claude/memory/integration-testing.md`, `web-app-prod-dockerfile-src-allowlist.md` -
  incidental Codeberg/Forgejo mentions
- `.claude/memory/MEMORY.md` and `.claude/INDEX.md` - index lines for the above

## Stage 4 - verification

1. Fresh clone into a scratch dir: `git clone --recurse-submodules https://github.com/Iron-Foundry/Foundry-Project.git`
2. `./run-tests.sh lint` and `./run-tests.sh fast` in the clone
3. Watch the first Actions runs: `gh run list` / `gh run watch`
4. Confirm the submodule-pointer loop fired end to end

## Stage 5 - decommission

The Codeberg repos cannot be pushed to or deleted from this account. Leave them
in place, dead, and let the README point at GitHub as the only source of truth.
No deploy path reads from Codeberg - the only references anywhere in the tree
are the docs, workflows and memory files listed in Stage 3.

## Risks

- **`SUBMODULE_PAT` is the single point of failure** for the pointer loop; if it
  is not recreated, submodule pushes land but the root pointers go stale.
- **`alert-autofix-1`** exists as a stale remote branch on api-backend from the
  GitHub era. It is already on GitHub; no action, but do not prune it blindly.
- **Old commits carry `Co-Authored-By: Claude ...` trailers** from before the
  current no-attribution rule. Rewriting them would change every SHA and is not
  proposed here; GitHub has no policy against them.
