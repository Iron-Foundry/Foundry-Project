"""discord -> api: the bot reads a saved playlist through the service key.

discord-utils holds no user JWT, so this surface is its only way to reach a
playlist. What it must get right is visibility: the service key names a user, it
does not bypass that user's rights.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import asyncpg
import httpx

API_URL = os.getenv("E2E_API_URL", "http://localhost:8000")
DB_DSN = os.getenv("E2E_DB_DSN", "postgresql://foundry:foundry@localhost:5432/foundry")
METRICS_API_KEY = os.getenv("E2E_METRICS_API_KEY", "e2e-metrics-key")

_FIXTURES = Path(__file__).resolve().parents[3] / "fixtures"

OWNER = 800800801
STRANGER = 800800802


async def _seed(owner: int, name: str, is_public: bool, tracks: list[dict]) -> int:
    conn = await asyncpg.connect(DB_DSN)
    try:
        await conn.execute(
            "DELETE FROM playlists WHERE owner_discord_id = $1 AND name = $2",
            owner,
            name,
        )
        playlist_id = await conn.fetchval(
            "INSERT INTO playlists (owner_discord_id, name, is_public)"
            " VALUES ($1, $2, $3) RETURNING id",
            owner,
            name,
            is_public,
        )
        for track in tracks:
            await conn.execute(
                "INSERT INTO playlist_tracks (playlist_id, position, source,"
                " identifier, title, author, duration_ms, isrc, uri)"
                " VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
                playlist_id,
                track["position"],
                track["source"],
                track["identifier"],
                track["title"],
                track["author"],
                track["duration_ms"],
                track["isrc"],
                track["uri"],
            )
        return int(playlist_id)
    finally:
        await conn.close()


def _fixture() -> dict:
    return json.loads((_FIXTURES / "music_playlist.json").read_text())


async def test_the_bot_reads_a_playlist_it_may_see() -> None:
    fixture = _fixture()
    playlist_id = await _seed(OWNER, "E2E Slayer Tunes", False, fixture["tracks"])

    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        resp = await client.get(
            f"/music/bot/{OWNER}/playlists/{playlist_id}",
            headers={"verification-code": METRICS_API_KEY},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == set(fixture), "bot playlist payload drifted from the fixture"
    assert [t["title"] for t in body["tracks"]] == [
        t["title"] for t in fixture["tracks"]
    ]


async def test_the_service_key_does_not_bypass_visibility() -> None:
    # Naming a user must not hand over someone else's private playlist.
    playlist_id = await _seed(STRANGER, "E2E Private", False, [])

    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        resp = await client.get(
            f"/music/bot/{OWNER}/playlists/{playlist_id}",
            headers={"verification-code": METRICS_API_KEY},
        )

    assert resp.status_code == 404


async def test_the_bot_surface_refuses_an_unknown_key() -> None:
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        resp = await client.get(
            f"/music/bot/{OWNER}/playlists",
            headers={"verification-code": "not-the-key"},
        )

    assert resp.status_code == 401
