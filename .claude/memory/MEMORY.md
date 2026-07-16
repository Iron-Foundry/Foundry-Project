<!-- Cross-session memory index — loaded into context at session start. One line per memory, no frontmatter, no memory content: just `- [Title](slug.md) — hook`. Facts live in .claude/memory/<slug>.md. Format + rules: ../rules/memory.md -->

# Memory

- [Memory location](memory-location.md) — project memory lives ONLY in repo `.claude/memory/`, never the harness auto-memory path
- [Secrets & startup](secrets-and-startup.md) — Infisical-managed secrets; started via root sh/ps1 scripts; bare docker compose recreates with blank env; both services auto-migrate (`alembic upgrade head`) on container start
- [Cache icon coverage](cache-icon-coverage.md) — cache serves item icons + UI sprites only (no NPC/boss art); how web-app sources item icons/names/skill icons off the Wiki
- [Cache image CORS](cache-image-cors.md) — proxied cache image endpoints must send Access-Control-Allow-Origin:* or cross-origin fetch/canvas loads break
- [Check refs before asking](check-refs-before-asking.md) — ls D:\claude-git-references before asking to clone a reference repo; runelite-repo etc already present
- [Icon render debugging](icon-render-debugging.md) — inspect actual rendered pixels via the fast in-container loop before rebuilding; render camera is clansocket auto-fit, NOT zoom2d
- [OSRS map blank / dead pan-zoom](osrs-map-embed-sizing.md) — dev-only blank + dead pan/zoom was OsrsMap's rAF `rafRef` not nulled on unmount, wedging the loop after StrictMode remount; instrument the loop (drawCanvas never logged) before size/coverage theories
