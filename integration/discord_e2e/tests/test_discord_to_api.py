"""discord -> api: a metrics report reaches the api and persists to the DB."""

from __future__ import annotations

import os

import asyncpg
import httpx

API_URL = os.getenv("E2E_API_URL", "http://localhost:8000")
DB_DSN = os.getenv("E2E_DB_DSN", "postgresql://foundry:foundry@localhost:5432/foundry")
METRICS_API_KEY = os.getenv("E2E_METRICS_API_KEY", "e2e-metrics-key")


async def test_metrics_report_persists(metrics_report_payload: dict) -> None:
    async with httpx.AsyncClient(base_url=API_URL, timeout=15) as client:
        resp = await client.post(
            "/metrics/report",
            json=metrics_report_payload,
            headers={"verification-code": METRICS_API_KEY},
        )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    conn = await asyncpg.connect(DB_DSN)
    try:
        row = await conn.fetchrow(
            "SELECT is_healthy, summary_metrics FROM service_status "
            "WHERE service_name = $1",
            metrics_report_payload["service_name"],
        )
    finally:
        await conn.close()

    assert row is not None
    assert row["is_healthy"] is True
