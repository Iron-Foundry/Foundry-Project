# osrs-cache-service

Pulls OSRS game cache builds from the [OpenRS2 Archive](https://archive.openrs2.org/),
decodes the JS5 cache format, and stores structured definitions (items, npcs, objects,
maps, sprites/icons, and more) plus raw undecoded cache groups in a dedicated
PostgreSQL database. Exposes a read-only FastAPI for other Foundry services.

See `CLAUDE.md` for architecture and conventions.
