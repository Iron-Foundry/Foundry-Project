"""Repository paths, platform facts, and resolution of the external tools we shell out to."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

INFISICAL_PROJECT_ID = "9047f633-a675-497c-8ca2-1e75ffd95db9"

SCRIPTS = Path(__file__).resolve().parent.parent
ROOT = SCRIPTS.parent

IS_WINDOWS = os.name == "nt"


def which(*names: str) -> str | None:
    """Return the first of `names` present on PATH, or None."""
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    return None


def bash() -> str | None:
    """Return a usable bash, including the Git for Windows one that is often off PATH."""
    found = which("bash")
    if found or not IS_WINDOWS:
        return found
    roots = [os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")]
    for base in filter(None, roots):
        for tail in ("Git/bin/bash.exe", "Programs/Git/bin/bash.exe"):
            candidate = Path(base) / tail
            if candidate.is_file():
                return str(candidate)
    return None


def powershell() -> str | None:
    return which("pwsh", "powershell")


def uv() -> str | None:
    found = which("uv")
    if found:
        return found
    home = Path(os.environ.get("USERPROFILE") or Path.home())
    candidate = home / ".local" / "bin" / ("uv.exe" if IS_WINDOWS else "uv")
    return str(candidate) if candidate.is_file() else None


RESOLVERS = {"bash": bash, "powershell": powershell, "uv": uv}


def missing(requirements: tuple[str, ...]) -> list[str]:
    """Return the subset of `requirements` that cannot be resolved on this machine."""
    absent = []
    for name in requirements:
        resolver = RESOLVERS.get(name)
        found = resolver() if resolver else which(name)
        if not found:
            absent.append(name)
    return absent
