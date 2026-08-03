"""Git history facts for the superproject and any nested repositories."""

import os
import subprocess
from collections import Counter
from dataclasses import dataclass, field

SUPER = "(superproject)"


@dataclass
class RepoStats:
    label: str
    branch: str
    head: str
    commits: int
    tracked: int
    first: str
    latest: str
    authors: Counter = field(default_factory=Counter)


def _git(cwd: str, *args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=60,
            encoding="utf-8",
            errors="replace",
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def is_repo(root: str) -> bool:
    return _git(root, "rev-parse", "--is-inside-work-tree") == "true"


def nested_repos(root: str) -> list[str]:
    """Relative paths of submodules, plus any nested .git directory."""
    found: list[str] = []
    status = _git(root, "submodule", "status", "--recursive")
    if status:
        for line in status.splitlines():
            parts = line.strip().split()
            if len(parts) >= 2:
                found.append(parts[1].replace(os.sep, "/"))
    return sorted(set(found))


def stats_for(root: str, label: str) -> RepoStats | None:
    if not is_repo(root):
        return None
    branch = _git(root, "rev-parse", "--abbrev-ref", "HEAD") or "-"
    head = _git(root, "rev-parse", "--short", "HEAD") or "-"
    count = _git(root, "rev-list", "--count", "HEAD")
    tracked_raw = _git(root, "ls-files")
    log = _git(root, "log", "--format=%ad", "--date=short")
    authors_raw = _git(root, "log", "--format=%an <%ae>")

    dates = log.splitlines() if log else []
    authors: Counter = Counter()
    if authors_raw:
        authors.update(line for line in authors_raw.splitlines() if line.strip())
    return RepoStats(
        label=label,
        branch=branch,
        head=head,
        commits=int(count) if count and count.isdigit() else 0,
        tracked=len(tracked_raw.splitlines()) if tracked_raw else 0,
        first=dates[-1] if dates else "-",
        latest=dates[0] if dates else "-",
        authors=authors,
    )


def collect(root: str) -> list[RepoStats]:
    """Superproject first, then each nested repository by commit count."""
    top = stats_for(root, SUPER)
    if top is None:
        return []
    results = [top]
    for rel in nested_repos(root):
        path = os.path.join(root, rel.replace("/", os.sep))
        if not os.path.isdir(path):
            continue
        sub = stats_for(path, rel)
        if sub is not None:
            results.append(sub)
    return results
