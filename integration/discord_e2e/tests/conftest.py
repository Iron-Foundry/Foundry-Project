"""Shared config for the discord <-> api end-to-end suite.

Targets the running e2e stack (docker-compose.e2e.yml) over the host-exposed
ports. Values match the throwaway credentials in that compose file.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

API_URL = os.getenv("E2E_API_URL", "http://localhost:8000")
DB_DSN = os.getenv(
    "E2E_DB_DSN", "postgresql://foundry:foundry@localhost:5432/foundry"
)
METRICS_API_KEY = os.getenv("E2E_METRICS_API_KEY", "e2e-metrics-key")

_FIXTURES = Path(__file__).resolve().parents[3] / "fixtures"


@pytest.fixture
def metrics_report_payload() -> dict:
    return json.loads((_FIXTURES / "metrics_report.json").read_text())
