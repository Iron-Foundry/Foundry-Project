"""Axis I (Existence) and Axis II (Arrangement)."""

from collections import defaultdict

import md
from walk import DOC_EXTS, FileRec, area_of

LARGEST_LIMIT = 30


def pick_expanded(files: list[FileRec]) -> set[str]:
    """Top-level directories worth splitting one level deeper."""
    tops: dict[str, set[str]] = defaultdict(set)
    counts: dict[str, int] = defaultdict(int)
    for rec in files:
        parts = rec.path.split("/")
        if len(parts) < 2:
            continue
        counts[parts[0]] += 1
        if len(parts) > 2:
            tops[parts[0]].add(parts[1])
    total = max(1, len(files))
    return {
        top
        for top, children in tops.items()
        if len(children) >= 3 and counts[top] >= total * 0.08
    }


def existence(files: list[FileRec], dir_count: int, extras: list[tuple[str, str]]) -> str:
    text = [f for f in files if not f.binary]
    rows = [
        ["Total files", md.num(len(files))],
        ["Text files analysed", md.num(len(text))],
        ["Binary / oversized files", md.num(len(files) - len(text))],
        ["Directories", md.num(dir_count)],
        ["Total lines", md.num(sum(f.lines for f in text))],
        ["Code lines (non-blank)", md.num(sum(f.code for f in text))],
        ["Blank lines", md.num(sum(f.blank for f in text))],
        ["On-disk size (scanned)", md.human_size(sum(f.size for f in files))],
        ["Test files", md.num(sum(1 for f in files if f.is_test))],
    ]
    docs = sum(1 for f in files if f.ext in DOC_EXTS)
    if docs:
        rows.append(["Documentation files", md.num(docs)])
    rows.extend([label, value] for label, value in extras)
    return md.section(
        "## I. Existence - what entities are present?",
        md.table(["Entity", "Count"], rows, align="lr"),
    )


def _areas(files: list[FileRec]) -> str:
    expanded = pick_expanded(files)
    groups: dict[str, list[FileRec]] = defaultdict(list)
    for rec in files:
        groups[area_of(rec.path, expanded)].append(rec)
    ordered = sorted(groups.items(), key=lambda kv: -sum(f.lines for f in kv[1]))
    peak = max((sum(f.lines for f in recs) for _, recs in ordered), default=0)
    rows = []
    for area, recs in ordered:
        lines = sum(f.lines for f in recs)
        rows.append(
            [
                f"`{area}`",
                md.num(len(recs)),
                md.num(lines),
                md.num(sum(f.code for f in recs)),
                md.human_size(sum(f.size for f in recs)),
                f"`{md.bar(lines, peak)}`",
            ]
        )
    header = ["Area", "Files", "Total lines", "Code lines", "Size", ""]
    body = md.table(header, rows, align="lrrrrl")
    note = (
        "Top-level areas"
        + (f", expanded one level within {', '.join(f'`{e}`' for e in sorted(expanded))}." if expanded else ".")
    )
    return f"### Areas\n\n{note}\n\n{body}\n"


def _distribution(files: list[FileRec]) -> str:
    text = sorted((f.lines for f in files if not f.binary))
    if not text:
        return ""
    total = len(text)
    mean = sum(text) / total
    median = text[total // 2]
    p90 = text[min(total - 1, int(total * 0.9))]
    rows = [
        ["Mean", md.num(int(round(mean)))],
        ["Median", md.num(median)],
        ["90th percentile", md.num(p90)],
        ["Largest", md.num(text[-1])],
        ["Maximum directory depth", md.num(max(f.depth for f in files))],
    ]
    body = md.table(["Measure", "Lines"], rows, align="lr")
    return f"### Size distribution (text files, by line count)\n\n{body}\n"


def _largest(files: list[FileRec]) -> str:
    ranked = sorted((f for f in files if not f.binary), key=lambda f: -f.lines)[:LARGEST_LIMIT]
    ranked = [f for f in ranked if f.lines > 0]
    if not ranked:
        return ""
    rows = [[str(i), f"`{rec.path}`", md.num(rec.lines)] for i, rec in enumerate(ranked, 1)]
    body = md.table(["#", "File", "Lines"], rows, align="rlr")
    return f"### Largest files (by line count)\n\n{body}\n"


def arrangement(files: list[FileRec]) -> str:
    parts = [p for p in (_areas(files), _distribution(files), _largest(files)) if p]
    if not parts:
        return ""
    return "## II. Arrangement - how are they organised?\n\n" + "\n".join(parts)
