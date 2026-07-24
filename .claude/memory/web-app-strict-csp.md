---
name: web-app-strict-csp
description: web-app prod-server enforces nonce-based strict CSP; Rocket Loader must stay off, esm.sh + style-src unsafe-inline are required
metadata:
  type: project
---

`web-app/src/prod-server.ts` serves an **enforcing** (not report-only) Content-Security-Policy on every SPA HTML response, built by `web-app/src/lib/security.ts` (`buildCsp` / `securityHeaders`, tested in `tests/lib/security.test.ts`). HSTS + `X-Content-Type-Options: nosniff` + `Referrer-Policy` ride along in the same header set; HSTS is also recommended at the Cloudflare edge for non-HTML responses.

`script-src` is nonce-based (`'nonce-<crypto.randomUUID()>'` per request), no `'unsafe-inline'`. The nonce is threaded into BOTH inline scripts via string replace in `renderDocument()`: the `window.__API_URL__` bootstrap and the `<script type="importmap">` tag.

**Non-obvious constraints (breaking any of these takes the site down under enforce mode):**
- **Cloudflare Rocket Loader MUST stay disabled** (Speed -> Optimization). It rewrites `<script>` tags and injects an un-nonced inline bootstrap, which strict CSP blocks. Also removes it from the fingerprint (see scan).
- **`https://esm.sh` must stay in `script-src` AND `connect-src`** - the built `dist/index.html` importmap loads `recharts` from esm.sh. Drop it and all charts break.
- **`style-src` must keep `'unsafe-inline'`** - React/Radix use inline `style=` attributes, which nonces cannot cover. Do not "tighten" this.
- **`frame-src` lists `youtube-nocookie.com` + `teamup.com`** - the only external iframes (video embeds, events page). Add here when a new external iframe is introduced.
- The importmap nonce depends on `build.ts` emitting `<script type="importmap">` verbatim; reformatting that emit silently drops the nonce and breaks charts.

**Why:** Pentest-Tools scan of ironfoundry.cc (2026-06-26) flagged missing CSP/HSTS + fingerprint. Site is behind Cloudflare, which already masks the FastAPI/Gunicorn backend, so the real wins were CSP (XSS mitigation) + HSTS, not obscurity.

**How to apply:** when touching web-app response headers or adding an external script/style/iframe/font source, edit `buildCsp` in `security.ts` and its test, never widen back to `'unsafe-inline'` scripts. [[recursive-settimeout-over-setinterval]] [[consult-before-layout-changes]]
