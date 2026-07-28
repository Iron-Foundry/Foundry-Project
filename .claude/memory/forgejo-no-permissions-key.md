---
name: forgejo-no-permissions-key
description: Forgejo Actions ignores the `permissions:` key in workflows and warns about it; token scope comes from Authorized Integrations instead
metadata:
  type: project
---

Forgejo Actions (Codeberg CI) does not support the GitHub Actions `permissions:` key, at
workflow or job level. Present keys are ignored and every run emits
`Job <name> or its workflow has a permissions field, which is not supported in Forgejo and
will be ignored. Use Authorized Integrations to grant capabilities to this job instead.`
On 2026-07-28 the key was removed from all `.forgejo/workflows/*.yml` in the root repo and
in the web-app, api-backend, discord-server, discord-utils, and discord-event submodules.

**Why:** the key is dead config that only produces noise; token scope on Codeberg is
granted per-repo through Authorized Integrations, not in the workflow file.

**How to apply:** never add `permissions:` to a `.forgejo/workflows/` file, and do not
copy it in from a GitHub Actions example. To narrow or widen a job's token, change the
repo's Authorized Integrations on Codeberg. Related: [[codeberg-push-auth-retry]],
[[integration-testing]].
