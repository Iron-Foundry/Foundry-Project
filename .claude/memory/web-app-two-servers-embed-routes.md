---
name: web-app-two-servers-embed-routes
description: web-app runs two separate Bun servers (dev src/index.tsx vs prod src/prod-server.ts); embed/OG routes must live in shared src/embed/routes.ts to appear in both
metadata:
  type: project
---

web-app has TWO independent Bun servers with separate route tables:
- `src/index.tsx` - the dev/HMR server (`bun dev`, and `bun start` too) and the HTML bundler entry.
- `src/prod-server.ts` - the production server, run ONLY by the Docker `CMD ["bun", "src/prod-server.ts"]`. It adds SPA-fallback OG-meta injection + static serving on port 3000.

A route added to only one of them is invisible in the other. This bit us: all `/embed/*.png`
OG-image routes, the `/embed/_fixtures/*` cards, and `/embed/_preview` originally lived only in
prod-server, so they 404'd under `bun dev`.

**Why:** prod does SPA OG injection that dev (HMR index.html) does not, so the two servers
diverged and drifted.

**How to apply:** shared embed request handling lives in `src/embed/routes.ts`
(`handleEmbedRoutes(req, apiUrl) => Response | null`); both servers call it first. When adding
or changing any `/embed/*` route, edit `routes.ts` - never a single server. Dev passes
`BUN_PUBLIC_API_URL`; prod passes `INTERNAL_API_URL`. Per-entry OG cards for
`/resources/$slug` + `/plugins/$slug` render via `serveContentEntry` (see [[web-app-strict-csp]]).
