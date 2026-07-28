---
name: wsl-shared-node-modules
description: Tests run from WSL against the Windows node_modules on /mnt/c, so package scripts must not use .bin shims
metadata:
  type: project
---

The user runs `./run-tests.sh` from **WSL**, against the repo checked out on
`/mnt/c` (OneDrive path). `node_modules` is therefore shared with Windows, and
whichever OS ran `bun install` last owns `node_modules/.bin`.

Windows installs write `tsc.exe` / `tsc.bunx`; a Linux bun (`~/.bun/bin/bun`,
found by `run-tests.sh`'s `_resolve`) sees no `tsc` there and the step dies with
`/usr/bin/bash: line 1: tsc: command not found` (exit 127).

**Rule:** a `web-app` package script must invoke the tool's JS entry point
through bun, never the bin shim:

```json
"typecheck": "bun node_modules/typescript/bin/tsc --noEmit",
"gen:api-types": "bun node_modules/openapi-typescript/bin/cli.js ../api-backend/openapi.json -o src/api/schema.d.ts"
```

Entry-point paths are plain JS and work from either OS. Apply the same shape to
any new script that shells out to a dependency's binary.

**Never** run `bun install` from WSL in `web-app` to "fix" this - it rewrites
`.bin` for Linux and breaks the user's Windows `bun dev` / `bun run build.ts`
until they reinstall. The same trap applies to the Python `.venv` directories.

A fully native WSL setup means cloning into the WSL filesystem (`~/...`, not
`/mnt/c`) so each OS gets its own `node_modules`; `/mnt/c` I/O is also slow
(a full `tsc --noEmit` there takes ~45s).

Related: [[integration-testing]].
