"""Axis III (Dynamics), Axis IV (Interaction) and Axis V (Abstraction)."""

from collections import Counter, defaultdict

import md
from gitinfo import SUPER, RepoStats
from packages import Package, internal_edges
from walk import DOC_EXTS, FileRec

TOP_PACKAGES = 15
BIG_FILE_LINES = 1000


def dynamics(repos: list[RepoStats]) -> str:
    if not repos:
        return ""
    top = repos[0]
    authors: Counter = Counter()
    for repo in repos:
        authors.update(repo.authors)
    dates = sorted(d for repo in repos for d in (repo.first, repo.latest) if d != "-")
    rows = [
        ["Superproject branch", f"`{top.branch}`"],
        ["Superproject HEAD", f"`{top.head}`"],
        ["Repositories", md.num(len(repos)) + (f" (1 super + {len(repos) - 1} nested)" if len(repos) > 1 else "")],
        ["Total commits (all repos)", md.num(sum(r.commits for r in repos))],
        ["Total tracked files (all repos)", md.num(sum(r.tracked for r in repos))],
        ["Earliest commit", dates[0] if dates else "-"],
        ["Latest commit", dates[-1] if dates else "-"],
        ["Unique contributors", md.num(len(authors))],
    ]
    parts = [md.table(["Metric", "Value"], rows, align="ll") + "\n"]

    if len(repos) > 1:
        per = sorted(repos, key=lambda r: (r.label != SUPER, -r.commits))
        body = md.table(
            ["Repository", "Branch", "HEAD", "Commits", "Tracked", "First", "Latest"],
            [
                [f"`{r.label}`", f"`{r.branch}`", f"`{r.head}`", md.num(r.commits), md.num(r.tracked), r.first, r.latest]
                for r in per
            ],
            align="lllrrll",
        )
        parts.append(f"### Per repository\n\n{body}\n")

    contributors = md.table(
        ["Commits", "Contributor"],
        [[md.num(count), name] for name, count in authors.most_common(10)],
        align="rl",
    )
    if contributors:
        parts.append(f"### Top contributors\n\n{contributors}\n")

    note = "Aggregated across the superproject and its nested repositories.\n\n" if len(repos) > 1 else ""
    return "## III. Dynamics - how do they change?\n\n" + note + "\n".join(parts)


def interaction(packages: list[Package]) -> str:
    edges = internal_edges(packages)
    if len(packages) < 2 or not edges:
        return ""
    by_name = {pkg.name: pkg for pkg in packages}
    fan_in: Counter = Counter(dep for _, dep in edges)
    fan_out: Counter = Counter(src for src, _ in edges)
    isolated = sum(1 for pkg in packages if fan_out[pkg.name] == 0)
    summary = (
        f"The internal dependency graph over the {len(packages)} discovered packages: "
        f"{len(edges)} internal edges, {isolated} packages with zero internal dependencies."
    )

    def rows(counter: Counter, label: str) -> str:
        return md.table(
            ["Package", label, "Location"],
            [
                [f"`{name}`", md.num(count), f"`{by_name[name].path}`"]
                for name, count in counter.most_common(TOP_PACKAGES)
            ],
            align="lrl",
        )

    return (
        "## IV. Interaction - how do they influence one another?\n\n"
        f"{summary}\n\n"
        f"### Most depended-upon (fan-in)\n\n{rows(fan_in, 'Dependents')}\n\n"
        f"### Most dependencies (fan-out)\n\n{rows(fan_out, 'Internal deps')}\n"
    )


def _file_mix(files: list[FileRec]) -> str:
    groups: dict[str, list[FileRec]] = defaultdict(list)
    for rec in files:
        groups[rec.ext].append(rec)
    total_code = max(1, sum(f.code for f in files if not f.binary))
    ordered = sorted(groups.items(), key=lambda kv: -sum(f.code for f in kv[1]))
    peak = max((sum(f.code for f in recs) for _, recs in ordered), default=0)
    rows = []
    for ext, recs in ordered:
        code = sum(f.code for f in recs)
        rows.append(
            [
                f"`{ext}`",
                md.num(len(recs)),
                md.num(code),
                md.num(sum(f.blank for f in recs)),
                md.human_size(sum(f.size for f in recs)),
                md.pct(code, total_code),
                f"`{md.bar(code, peak, 24)}`",
            ]
        )
    body = md.table(
        ["Extension", "Files", "Code lines", "Blank", "Size", "Share", ""],
        rows,
        align="lrrrrrl",
    )
    return f"### File-type mix (by extension, auto-discovered)\n\n{body}\n"


def _ratios(files: list[FileRec], packages: list[Package]) -> str:
    text = [f for f in files if not f.binary]
    lines = max(1, sum(f.lines for f in text))
    rows = [
        ["Blank-line share", md.pct(sum(f.blank for f in text), lines)],
        ["Test files / text files", md.pct(sum(1 for f in files if f.is_test), max(1, len(text)))],
        ["Documentation files / text files", md.pct(sum(1 for f in text if f.ext in DOC_EXTS), max(1, len(text)))],
    ]
    if packages:
        readme = sum(1 for p in packages if p.has_readme)
        tested = sum(1 for p in packages if p.has_tests)
        count = len(packages)
        rows.append(["Packages with a README", f"{readme} / {count} ({md.pct(readme, count)})"])
        rows.append(["Packages with tests", f"{tested} / {count} ({md.pct(tested, count)})"])
    body = md.table(["Ratio", "Value"], rows, align="lr")
    return f"### Derived ratios\n\n{body}\n"


def _anomalies(files: list[FileRec], packages: list[Package]) -> str:
    text = [f for f in files if not f.binary]
    rows = [
        ["Empty text files (0 lines)", md.num(sum(1 for f in text if f.lines == 0))],
        [f"Files over {BIG_FILE_LINES:,} lines", md.num(sum(1 for f in text if f.lines > BIG_FILE_LINES))],
    ]
    if packages:
        rows.append(["Packages missing a README", md.num(sum(1 for p in packages if not p.has_readme))])
        rows.append(["Packages missing tests", md.num(sum(1 for p in packages if not p.has_tests))])
    body = md.table(["Anomaly", "Count"], rows, align="lr")
    return f"### Novelty - what deviates from expectation?\n\n{body}\n"


def abstraction(files: list[FileRec], packages: list[Package], extra: list[str]) -> str:
    parts = [_file_mix(files), _ratios(files, packages), *extra, _anomalies(files, packages)]
    return "## V. Abstraction - what principle can be inferred?\n\n" + "\n".join(p for p in parts if p)
