---
name: no-artifacts
description: Artifact tool is banned in this repo; deliver visual mockups as a local HTML file instead
metadata:
  type: feedback
---

Never use the `Artifact` tool. The user explicitly banned it (2026-07-26). When a visual mockup, design comparison, or any HTML deliverable is asked for, write a self-contained `.html` file to the session scratchpad directory and tell the user the path to open.

**Why:** publishing to claude.ai hosts the work externally, and it is a skill/tool spawn the user does not want; a local file gives the same visual result with no external publish. Consistent with [[memory-location]] and the AXIOM's no-unsanctioned-spawn rule.

**How to apply:** build the mockup as one standalone HTML file (inline CSS/JS, no CDN), reuse the real design tokens from `web-app/styles/globals.css` so it looks like the actual site, and hand over the absolute path. Never call `Artifact`, and never load `artifact-design` / `artifact-capabilities`.
