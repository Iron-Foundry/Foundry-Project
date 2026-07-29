---
name: no-artifacts
description: Artifact tool is banned in this repo; deliver visual mockups as a local HTML file instead
metadata:
  type: feedback
---

Never use the `Artifact` tool. The user explicitly banned it (2026-07-26). When a visual mockup, design comparison, preview, or any HTML deliverable is asked for, write a self-contained `.html` file into the repo's `previews/` directory and tell the user the path.

**Why:** publishing to claude.ai hosts the work externally, and it is a skill/tool spawn the user does not want; a local file gives the same visual result with no external publish. `previews/` rather than the scratchpad because these are kept work products the user opens again later - the directory already holds the OSRS map and cache-archive previews - and a scratchpad path dies with the session (corrected 2026-07-29). Consistent with [[memory-location]] and the AXIOM's no-unsanctioned-spawn rule.

**How to apply:** build it as one standalone HTML file (inline CSS/JS, no CDN), reuse the real design tokens from `web-app/styles/globals.css` so it looks like the actual site, name it `<subject>-<kind>.html`, and hand over the path. Cross-link related previews with plain relative hrefs, since they share the directory. Never call `Artifact`, and never load `artifact-design` / `artifact-capabilities`.
