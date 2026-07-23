"""Authed user journey through the running stack: JWT -> mutate -> DB -> close.

Mints the same HS256 JWT the api issues after Discord OAuth, then drives a
party create/read/update/close lifecycle through real gunicorn + Postgres,
asserting persistence in the DB at each step.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import asyncpg
import httpx
import jwt

API_URL = os.getenv("E2E_API_URL", "http://localhost:8000")
DB_DSN = os.getenv("E2E_DB_DSN", "postgresql://foundry:foundry@localhost:5432/foundry")
JWT_SECRET = os.getenv("E2E_JWT_SECRET", "e2e-test-secret-e2e-test-secret-01")

_USER_ID = "111222333444555666"


def _token() -> str:
    payload = {
        "sub": _USER_ID,
        "username": "JourneyUser",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def _party_status(party_id: str) -> str | None:
    conn = await asyncpg.connect(DB_DSN)
    try:
        return await conn.fetchval(
            "SELECT status FROM parties WHERE id = $1", party_id
        )
    finally:
        await conn.close()


async def test_authed_party_journey() -> None:
    auth = {"Authorization": f"Bearer {_token()}"}
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        created = await client.post(
            "/parties/",
            json={"activity": "Nightmare", "max_size": 5, "vibe": "sweat"},
            headers=auth,
        )
        assert created.status_code == 201, created.text
        pid = created.json()["id"]

        # Persisted and live in the public list.
        assert await _party_status(pid) is not None
        listed = await client.get("/parties/")
        assert any(p["id"] == pid for p in listed.json())

        updated = await client.patch(
            f"/parties/{pid}", json={"activity": "Nightmare (CC)"}, headers=auth
        )
        assert updated.status_code == 200
        assert updated.json()["activity"] == "Nightmare (CC)"

        closed = await client.delete(f"/parties/{pid}", headers=auth)
        assert closed.status_code == 200

    assert await _party_status(pid) == "closed"


async def test_invalid_token_rejected() -> None:
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        resp = await client.post(
            "/parties/",
            json={"activity": "x", "max_size": 2},
            headers={"Authorization": "Bearer not.a.valid.jwt"},
        )
    assert resp.status_code == 401
