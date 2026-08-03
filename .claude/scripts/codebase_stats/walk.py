"""Filesystem scan: one FileRec per file, with text/binary classification."""

import os
import re
from dataclasses import dataclass

SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "__pycache__", ".venv", "venv",
    ".mypy_cache", ".ruff_cache", ".pytest_cache", ".tox", ".nox", ".turbo",
    ".next", ".nuxt", ".svelte-kit", ".parcel-cache", ".gradle", ".idea",
    ".vs", "dist", "build", "out", "target", "coverage", ".coverage",
    ".terraform", "vendor", ".cache", ".bun", "site-packages",
}

TEST_PATTERN = re.compile(
    r"(^|/)(tests?|__tests__|spec|specs|e2e|integration)(/|$)"
    r"|(^|/)(test_[^/]+|[^/]+_test|[^/]+\.test|[^/]+\.spec)\.[A-Za-z0-9]+$"
)

DOC_EXTS = {".md", ".mdx", ".rst", ".adoc", ".txt"}
CONFIG_NAMES = {
    "package.json", "pyproject.toml", "cargo.toml", "go.mod", "composer.json",
    "build.gradle", "pom.xml", "gemfile", "deno.json", "bun.lockb",
}


@dataclass
class FileRec:
    path: str
    name: str
    ext: str
    size: int
    lines: int
    code: int
    blank: int
    binary: bool
    depth: int
    is_test: bool


def _classify(raw: bytes) -> bool:
    return b"\x00" in raw[:8192]


def _count(raw: bytes) -> tuple[int, int, int]:
    text = raw.decode("utf-8", errors="replace")
    if not text:
        return 0, 0, 0
    lines = text.splitlines()
    blank = sum(1 for line in lines if not line.strip())
    return len(lines), len(lines) - blank, blank


def scan(root: str, extra_skip: set[str], max_bytes: int) -> tuple[list[FileRec], int]:
    """Walk root, returning (file records, directory count)."""
    skip = SKIP_DIRS | extra_skip
    files: list[FileRec] = []
    dir_count = 0
    root = os.path.abspath(root)

    for current, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in skip)
        dir_count += len(dirnames)
        for filename in sorted(filenames):
            full = os.path.join(current, filename)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            try:
                size = os.path.getsize(full)
            except OSError:
                continue
            ext = os.path.splitext(filename)[1].lower()
            depth = rel.count("/") + 1
            binary = size > max_bytes
            lines = code = blank = 0
            if not binary:
                try:
                    with open(full, "rb") as handle:
                        raw = handle.read()
                except OSError:
                    continue
                binary = _classify(raw)
                if not binary:
                    lines, code, blank = _count(raw)
            files.append(
                FileRec(
                    path=rel,
                    name=filename,
                    ext=ext or "(no extension)",
                    size=size,
                    lines=lines,
                    code=code,
                    blank=blank,
                    binary=binary,
                    depth=depth,
                    is_test=bool(TEST_PATTERN.search(rel.lower())),
                )
            )
    return files, dir_count


def area_of(path: str, expanded: set[str]) -> str:
    """Bucket a file into a top-level area, expanding container directories."""
    parts = path.split("/")
    if len(parts) == 1:
        return "(root files)"
    top = parts[0]
    if top in expanded and len(parts) > 2:
        return f"{top}/{parts[1]}"
    return top
