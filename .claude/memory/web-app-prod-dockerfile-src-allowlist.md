---
name: web-app-prod-dockerfile-src-allowlist
description: web-app prod Docker image copies an explicit allowlist of src files, not the whole src tree; a new prod-server import needs a matching COPY line
metadata:
  type: project
---

The web-app `Dockerfile` final prod stage does NOT `COPY . .`. It copies an
explicit allowlist into the image: `src/prod-server.ts`, the whole `src/embed`
dir, `src/assets/fonts`, and named `src/lib/*.ts` files (security, sitemap,
structured-data, agent-discovery, markdown-negotiation). `CMD` runs the source
directly (`bun src/prod-server.ts`), not a bundle.

**Why:** Any NEW runtime (value) import added to `src/prod-server.ts` (or to a
file it transitively pulls in at runtime) MUST get a matching `COPY --from=builder`
line in the Dockerfile, or the prod container crash-loops at boot with
`error: Cannot find module './lib/xxx'` and Traefik serves a bare 404
(text/plain, 19 bytes) for every route while Cloudflare masks it with stale
cached copies of `/robots.txt`. This bit us: the SEO commit imported
`./lib/structured-data` without a COPY line and took prod down.

**How to apply:** When editing `prod-server.ts` imports, diff them against the
Dockerfile COPY list. `import type` lines are elided by Bun and need no COPY
(e.g. `./types/content` is never copied). Only value imports matter. After
adding, `git grep -oE 'src/lib/[a-z-]+\.ts' Dockerfile` vs the value imports.
Related: [[web-app-two-servers-embed-routes]], [[web-app-strict-csp]],
[[codeberg-push-auth-retry]].
