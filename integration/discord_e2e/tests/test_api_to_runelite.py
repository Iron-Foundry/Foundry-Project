"""api -> runelite: a dispatch POST reaches a connected clan-chat WebSocket."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import asyncpg
import httpx
import websockets

API_URL = os.getenv("E2E_API_URL", "http://localhost:8000")
DB_DSN = os.getenv("E2E_DB_DSN", "postgresql://foundry:foundry@localhost:5432/foundry")

_API_KEY = "e2e-runelite-key"
_GUILD_ID = 555000222
_DISCORD_USER_ID = 800800800


async def _seed_user() -> None:
    conn = await asyncpg.connect(DB_DSN)
    try:
        now = datetime.now(timezone.utc)
        await conn.execute(
            "INSERT INTO users (discord_user_id, discord_username, guild_id, "
            "api_key, key_is_active, created_at, updated_at) "
            "VALUES ($1, $2, $3, $4, true, $5, $5) "
            "ON CONFLICT (discord_user_id) DO UPDATE SET "
            "api_key = EXCLUDED.api_key, key_is_active = true",
            _DISCORD_USER_ID,
            "e2e-runelite",
            _GUILD_ID,
            _API_KEY,
            now,
        )
    finally:
        await conn.close()


async def test_dispatch_reaches_ws() -> None:
    await _seed_user()

    ws_url = API_URL.replace("http", "ws", 1) + "/ccdispatch"
    async with websockets.connect(
        ws_url, additional_headers={"verification-code": _API_KEY}
    ) as ws:
        hello = json.loads(await ws.recv())
        assert hello["message_type"] == "ToClanChat"
        assert hello["message"]["sender"] == "System"

        async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
            resp = await client.post(
                "/ccdispatch",
                json={"sender": "Zezima", "message": "e2e drop", "rank": "Owner"},
                headers={"verification-code": _API_KEY},
            )
        assert resp.status_code == 200

        frame = json.loads(await ws.recv())
        assert frame["message_type"] == "ToClanChat"
        assert frame["message"]["sender"] == "Zezima"
        assert frame["message"]["message"] == "e2e drop"
