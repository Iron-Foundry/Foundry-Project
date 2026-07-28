from __future__ import annotations

import re

import pytest

from app.api.routers.meta import get_version
from app.version import VERSION

_SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def test_declared_version_is_semver() -> None:
    assert _SEMVER.match(VERSION), f"version {VERSION!r} is not MAJOR.MINOR.PATCH"


async def test_version_reports_package_version() -> None:
    result = await get_version()
    assert result.service == "osrs-cache-service"
    assert result.version == VERSION


async def test_version_reads_build_provenance(monkeypatch: pytest.MonkeyPatch) -> None:
    """GIT_SHA and BUILD_TIME are injected as container build arguments."""
    monkeypatch.setenv("GIT_SHA", "a9adca9")
    monkeypatch.setenv("BUILD_TIME", "2026-07-28T09:14:22Z")
    result = await get_version()
    assert result.git_sha == "a9adca9"
    assert result.build_time == "2026-07-28T09:14:22Z"


async def test_version_provenance_is_null_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("GIT_SHA", raising=False)
    monkeypatch.delenv("BUILD_TIME", raising=False)
    result = await get_version()
    assert result.git_sha is None
    assert result.build_time is None
