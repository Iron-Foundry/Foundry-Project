"""web -> api -> discord: driving a live session from the website.

Both halves of the seam meet here. The session is seeded into Valkey exactly as
discord-utils leaves it, the website reads and drives it with a real JWT through
gunicorn, and the command is watched on the pubsub channel the bot subscribes
to - so a rename on either side of the bridge fails this rather than going
quietly unnoticed until someone presses a button in production.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import jwt
import pytest
import websockets
from valkey.asyncio import Valkey

API_URL = os.getenv("E2E_API_URL", "http://localhost:8000")
VALKEY_URI = os.getenv("E2E_VALKEY_URI", "redis://localhost:6379")
JWT_SECRET = os.getenv("E2E_JWT_SECRET", "e2e-test-secret-e2e-test-secret-01")

_FIXTURES = Path(__file__).resolve().parents[3] / "fixtures"

USER_ID = "111222333444555666"
# A real Discord snowflake, deliberately above 2^53: a browser parsing this as a
# JSON number rounds off its last digits, and the rounded id addresses a channel
# nobody is in. Anything smaller would pass while the bug was still there.
CHANNEL_ID = 1479967329084375071
BASE = f"/music/sessions/{CHANNEL_ID}"
DELIVERY_TIMEOUT_SECONDS = 10
# The stats consumer blocks on the stream for five seconds at a time, so a new
# event is picked up within one poll plus the commit.
STATS_TIMEOUT_SECONDS = 30


def token() -> str:
    payload = {
        "sub": USER_ID,
        "username": "MusicJourney",
        "exp": datetime.now(UTC) + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def fixture() -> dict[str, Any]:
    return json.loads((_FIXTURES / "music_bridge.json").read_text())


def session_keys() -> tuple[str, str, str, str]:
    return (
        f"music:session:{CHANNEL_ID}",
        f"music:queue:{CHANNEL_ID}",
        f"music:voice:{CHANNEL_ID}",
        f"music:history:{CHANNEL_ID}",
    )


@pytest.fixture
async def live_session():
    """A session in Valkey, shaped exactly as discord-utils would leave it."""
    session_key, queue_key, voice_key, history_key = session_keys()
    valkey = Valkey.from_url(VALKEY_URI)
    try:
        await valkey.delete(*session_keys())
        await valkey.hset(session_key, mapping=fixture()["session_hash"])
        await valkey.rpush(queue_key, fixture()["session_hash"]["track"])
        await valkey.sadd(voice_key, USER_ID)
        await valkey.rpush(history_key, fixture()["history_entry"])
        yield valkey
        await valkey.delete(*session_keys())
    finally:
        await valkey.aclose()


async def test_the_website_sees_a_session_the_bot_created(live_session: Any) -> None:
    auth = {"Authorization": f"Bearer {token()}"}
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        listed = await client.get("/music/sessions", headers=auth)
        detail = await client.get(BASE, headers=auth)
        queue = await client.get(f"{BASE}/queue", headers=auth)

    assert listed.status_code == 200
    assert str(CHANNEL_ID) in [row["voice_channel_id"] for row in listed.json()]

    body = detail.json()
    assert body["channel_name"] == "Music Lounge"
    assert body["current"]["title"] == "Zanaris Nocturne"
    # Every id crosses as a string, exact to the last digit.
    assert body["voice_channel_id"] == str(CHANNEL_ID)
    assert body["current"]["requester_id"] == USER_ID
    # The encoded audio stays server side; only metadata crosses to a browser.
    assert "encoded" not in body["current"]
    assert [row["title"] for row in queue.json()] == ["Zanaris Nocturne"]


async def test_a_web_command_reaches_the_channel_the_bot_listens_on(
    live_session: Any,
) -> None:
    auth = {"Authorization": f"Bearer {token()}"}
    async with live_session.pubsub() as pubsub:
        await pubsub.subscribe(fixture()["channels"]["commands"])
        await pubsub.get_message(timeout=5)

        async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
            sent = await client.post(
                f"{BASE}/commands",
                json={"action": "seek", "position_ms": 90_000},
                headers=auth,
            )
        assert sent.status_code == 200, sent.text
        delivered = json.loads(await _next_message(pubsub))

    assert delivered == {
        "voice_channel_id": CHANNEL_ID,
        "actor_id": int(USER_ID),
        "action": "seek",
        "position_ms": 90_000,
    }


async def test_added_tracks_reach_the_bot_without_a_second_search(
    live_session: Any,
) -> None:
    auth = {"Authorization": f"Bearer {token()}"}
    picked = {
        "source": "spotify",
        "identifier": "abc123",
        "title": "Zanaris Nocturne",
        "author": "Barbarian Assault",
        "duration_ms": 180_000,
        "isrc": "USABC1234567",
        "uri": "https://open.spotify.com/track/abc123",
        "artwork": "https://i.scdn.co/image/abc123",
    }

    async with live_session.pubsub() as pubsub:
        await pubsub.subscribe(fixture()["channels"]["commands"])
        await pubsub.get_message(timeout=5)

        async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
            sent = await client.post(
                f"{BASE}/commands",
                json={"action": "add", "tracks": [picked]},
                headers=auth,
            )
        assert sent.status_code == 200, sent.text
        delivered = json.loads(await _next_message(pubsub))

    # The metadata the caller picked travels with the command, so the bot queues
    # that track rather than whatever a fresh search would have returned.
    assert delivered["action"] == "add"
    assert delivered["tracks"] == [picked]


async def test_the_website_reads_the_history_the_bot_wrote(
    live_session: Any,
) -> None:
    # The history key name is spelled out separately in both repos rather than
    # shared as a package, so this is where the two spellings actually meet.
    auth = {"Authorization": f"Bearer {token()}"}
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        response = await client.get(f"{BASE}/history", headers=auth)

    body = response.json()
    assert response.status_code == 200
    assert [row["track"]["title"] for row in body] == ["Zanaris Nocturne"]
    assert body[0]["event"] == "skipped"
    # Metadata only, the same rule the queue and the session payload follow.
    assert "encoded" not in body[0]["track"]
    assert body[0]["track"]["requester_id"] == USER_ID


async def test_a_played_track_can_be_queued_again_from_the_website(
    live_session: Any,
) -> None:
    """The whole re-queue journey: read the history, send one entry back.

    No new command exists for this. A history entry carries the same metadata a
    search result does, so it re-queues down the identical `add` path - which is
    what keeps the bot from having to know where the track came from.
    """
    auth = {"Authorization": f"Bearer {token()}"}
    async with live_session.pubsub() as pubsub:
        await pubsub.subscribe(fixture()["channels"]["commands"])
        await pubsub.get_message(timeout=5)

        async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
            history = (await client.get(f"{BASE}/history", headers=auth)).json()
            played = history[0]["track"]
            again = {
                "source": played["source"],
                "identifier": played["identifier"],
                "title": played["title"],
                "author": played["author"],
                "duration_ms": played["length_ms"],
                "isrc": played["isrc"],
                "uri": played["uri"],
                # The website sends the cover back with the track. Nothing
                # downstream can look it up again.
                "artwork": played["artwork"],
            }
            sent = await client.post(
                f"{BASE}/commands",
                json={"action": "add", "tracks": [again]},
                headers=auth,
            )
        assert sent.status_code == 200, sent.text
        delivered = json.loads(await _next_message(pubsub))

    assert delivered["action"] == "add"
    assert delivered["tracks"] == [again]


async def test_the_clan_stats_endpoints_answer(live_session: Any) -> None:
    # No events have to have happened: an empty window is zeroes, not a 404,
    # so the page renders on a stack where nobody has played anything yet.
    auth = {"Authorization": f"Bearer {token()}"}
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        stats = await client.get("/music/stats?days=7", headers=auth)
        top = await client.get("/music/stats/top-tracks", headers=auth)

    assert stats.status_code == 200
    body = stats.json()
    assert body["days_requested"] == 7
    assert isinstance(body["ms_listened"], int)
    assert top.status_code == 200
    assert isinstance(top.json(), list)


async def test_the_stats_consumer_turns_events_into_totals(
    live_session: Any,
) -> None:
    """The Stage 8 seam end to end: an event on the stream becomes a total.

    The counters are written by a background consumer rather than by the request
    that reads them, so this polls instead of asserting once - what is under
    test is that the loop is actually running in the deployed stack.
    """
    auth = {"Authorization": f"Bearer {token()}"}
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        before = (await client.get("/music/stats?days=1", headers=auth)).json()
        await live_session.xadd(
            "music:events",
            {
                "event": "track_played",
                "guild_id": "1234567890",
                "isrc": "USE2E1234567",
                "title": "E2E Shanty",
                "author": "Barbarian Assault",
                "identifier": "e2e-1",
                "requested_source": "spotify",
                "played_source": "youtube",
                "length_ms": "180000",
                "listened_ms": "180000",
            },
        )

        async with asyncio.timeout(STATS_TIMEOUT_SECONDS):
            while True:
                after = (await client.get("/music/stats?days=1", headers=auth)).json()
                if after["tracks_played"] > before["tracks_played"]:
                    break
                await asyncio.sleep(1)

    assert after["ms_listened"] >= before["ms_listened"] + 180_000
    assert after["sources"].get("youtube", 0) >= 1


async def test_search_reports_itself_unavailable_without_a_node(
    live_session: Any,
) -> None:
    # The e2e stack runs no Lavalink, which is the same shape as a deployment
    # with music switched off: a clear 503, not a stack trace.
    auth = {"Authorization": f"Bearer {token()}"}
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        response = await client.get("/music/search?q=zanaris", headers=auth)

    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


async def test_search_requires_a_login() -> None:
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        assert (await client.get("/music/search?q=zanaris")).status_code == 401


async def test_someone_outside_the_channel_cannot_drive_it(live_session: Any) -> None:
    # The roster is the same set the Discord panel checks, so leaving the voice
    # channel has to take web control away too.
    _, _, voice_key, _ = session_keys()
    await live_session.srem(voice_key, USER_ID)
    auth = {"Authorization": f"Bearer {token()}"}

    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        control = await client.get(f"{BASE}/control", headers=auth)
        refused = await client.post(f"{BASE}/commands", json={"action": "skip"}, headers=auth)

    assert control.json() == {"may_control": False}
    assert refused.status_code == 403


async def test_the_live_socket_hands_over_a_snapshot(live_session: Any) -> None:
    url = API_URL.replace("http", "ws", 1) + "/music/live"
    async with websockets.connect(url) as socket:
        await socket.send(json.dumps({"type": "auth", "token": token()}))
        frame = json.loads(await asyncio.wait_for(socket.recv(), DELIVERY_TIMEOUT_SECONDS))

    assert frame["type"] == "sessions"
    assert str(CHANNEL_ID) in [row["voice_channel_id"] for row in frame["sessions"]]


async def test_the_live_socket_refuses_a_bad_token(live_session: Any) -> None:
    url = API_URL.replace("http", "ws", 1) + "/music/live"
    async with websockets.connect(url) as socket:
        await socket.send(json.dumps({"type": "auth", "token": "not.a.jwt"}))
        with pytest.raises(websockets.exceptions.ConnectionClosed):
            await asyncio.wait_for(socket.recv(), DELIVERY_TIMEOUT_SECONDS)


async def _next_message(pubsub: Any) -> str:
    """The next real message, skipping the subscribe confirmations."""
    async with asyncio.timeout(DELIVERY_TIMEOUT_SECONDS):
        while True:
            message = await pubsub.get_message(timeout=1)
            if message and message["type"] == "message":
                return message["data"]
