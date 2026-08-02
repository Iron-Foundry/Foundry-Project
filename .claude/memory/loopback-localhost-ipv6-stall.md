---
name: loopback-localhost-ipv6-stall
description: On this Windows host "localhost" resolves to ::1 first, costing ~2s per client connect to a docker-published port; always use 127.0.0.1 in test and tooling URLs
metadata:
  type: project
---

Docker publishes ports on the IPv4 loopback (`127.0.0.1:PORT`), but `localhost`
resolves to `['::1', '127.0.0.1']` on this host. Clients that try `::1` first
stall before falling back. Measured 2026-08-02 against a `valkey/valkey:8-alpine`
container: `Valkey.from_url("redis://localhost:PORT")` took **2.056s** to
connect, `redis://127.0.0.1:PORT` took **0.005s**.

This was the entire cost of the `discord_e2e` suite - 54.1s for 19 tests, of
which ~50s was per-test fixtures reconnecting. Switching the `E2E_*` URLs and
the matching `docker-compose.e2e.yml` env to `127.0.0.1` took it to **2.5s**.

**Why:** a plain `socket.create_connection` gets an instant refusal on `::1` and
falls through, so the stall is invisible in a naive probe - it only shows up in
clients with their own connect/retry logic. That is why it hid for so long.

**How to apply:** never write `localhost` in a URL that crosses from the host
into a docker-published port - `E2E_*` exports, compose `FRONTEND_URL` /
`API_BACKEND_URL` / `BUN_PUBLIC_API_URL` / `SITE_URL`, or any test default. Both
sides must agree: the browser Origin and the api's CORS allowlist are compared
as strings, so changing one without the other breaks CORS and the OAuth
redirect. Container-internal healthchecks may keep `localhost`. If a suite is
mysteriously slow in fixed ~2s steps, suspect this before profiling the code.
See [[integration-testing]].
