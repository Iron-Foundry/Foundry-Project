# The Iron Foundry Project

> A comprehensive multi-service platform powering the Iron Foundry OSRS Clan & Community

[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289da?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/ironfoundry)
[![OSRS](https://img.shields.io/badge/OSRS-Ironman%20Community-cd7f32?style=for-the-badge)](https://ironfoundry.cc)

---

## Overview

This repository is the monorepo root for The Iron Foundry Project. It tracks five services as
Git submodules. Each service lives in its own repository under the
[Iron-Foundry](https://github.com/Iron-Foundry) GitHub organisation.

Submodule references are kept up to date automatically — pushing to `main` in any submodule
triggers a GitHub Actions workflow in this repo that advances the recorded commit pointer.

---

## Services

### Discord

| Service | Stack | Purpose |
|---|---|---|
| **discord-server** | Python 3.14+, discord.py | Core bot — ticket system, role management, action logging, server automation |
| **discord-utils** | Python 3.14+, discord.py | Utility bot — temporary voice channels, OTW image generation, clan event relay |
| **discord-event** | Python 3.13+, discord.py | Event bot — bingo events, team coordination, submission review |

### Backend & Frontend

| Service | Stack | Purpose |
|---|---|---|
| **api-backend** | Python 3.14+, FastAPI | REST API backend |
| **web-app** | TypeScript, React 19, Bun | Community web application |

### Repositories

| Service | Repository |
|---|---|
| discord-server | [Iron-Foundry/discord-server](https://github.com/Iron-Foundry/discord-server) |
| discord-utils | [Iron-Foundry/discord-utils](https://github.com/Iron-Foundry/discord-utils) |
| discord-event | [Iron-Foundry/discord-event](https://github.com/Iron-Foundry/discord-event) |
| api-backend | [Iron-Foundry/api-backend](https://github.com/Iron-Foundry/api-backend) |
| web-app | [Iron-Foundry/web-app](https://github.com/Iron-Foundry/web-app) |

---

## Getting Started

Clone the repo with all submodules:

```bash
git clone --recurse-submodules https://github.com/Iron-Foundry/Foundry-Project
```

Or if you've already cloned without submodules:

```bash
git submodule update --init --recursive
```

Refer to the README in each submodule directory for service-specific setup instructions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Python services | Python 3.13+/3.14+, `uv` package manager, Ruff, Pyright |
| Web app | TypeScript, React 19, Bun, TanStack Router, Tailwind CSS, Shadcn/ui |
| Database | PostgreSQL (primary, shared across discord-server, discord-utils, api-backend), MongoDB (discord-event), Valkey/Redis (caching) |
| Quality | Ruff, Mypy/Pyright, Bandit, pre-commit hooks |
| CI/CD | GitHub Actions |

---

<div align="center">

Built with love for the Iron Foundry Community

[Discord](https://discord.gg/ironfoundry) • [Website](https://ironfoundry.cc)

</div>
