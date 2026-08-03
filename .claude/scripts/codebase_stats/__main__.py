"""Generate CODEBASE-STATS.md - a five-axis overview of any repository.

Usage: python .claude/scripts/codebase_stats [PATH] [-o OUT] [--stdout]
"""

import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timezone

import gitinfo
import md
import packages as pkgs
import sec_analysis
import sec_entities
from walk import scan

MAX_BYTES = 5 * 1024 * 1024

AXES = [
    ("I. Existence", "What entities are present?", "files, directories, packages, repositories"),
    ("II. Arrangement", "How are they organised?", "areas, nesting depth, size distribution, largest files"),
    ("III. Dynamics", "How do they change?", "git history across every repository found"),
    ("IV. Interaction", "How do they influence one another?", "the internal package dependency graph"),
    ("V. Abstraction", "What principle can be inferred?", "file-type mix, ratios, anomalies"),
]


def _memory_section(root: str) -> str:
    folder = os.path.join(root, ".claude", "memory")
    if not os.path.isdir(folder):
        return ""
    files = [f for f in sorted(os.listdir(folder)) if f.endswith(".md")]
    facts = [f for f in files if f != "MEMORY.md"]
    types: Counter = Counter()
    size = 0
    for name in files:
        full = os.path.join(folder, name)
        size += os.path.getsize(full)
        if name == "MEMORY.md":
            continue
        with open(full, encoding="utf-8", errors="replace") as handle:
            head = handle.read(600)
        kind = "unspecified"
        for line in head.splitlines():
            if line.strip().startswith("type:"):
                kind = line.split(":", 1)[1].strip() or "unspecified"
                break
        types[kind] += 1
    index = 0
    index_path = os.path.join(folder, "MEMORY.md")
    if os.path.isfile(index_path):
        with open(index_path, encoding="utf-8", errors="replace") as handle:
            index = sum(1 for line in handle if line.lstrip().startswith("- ["))
    summary = md.table(
        ["Metric", "Value"],
        [
            ["Memory files", md.num(len(facts))],
            ["`MEMORY.md` index entries", md.num(index)],
            ["Store size", md.human_size(size)],
        ],
        align="lr",
    )
    breakdown = md.table(
        ["Type", "Files"],
        [[kind, md.num(count)] for kind, count in types.most_common()],
        align="lr",
    )
    return f"### Claude memory\n\n{summary}\n\n{breakdown}\n"


def _packages_section(found: list[pkgs.Package]) -> str:
    if not found:
        return ""
    kinds: Counter = Counter(p.kind for p in found)
    body = md.table(
        ["Ecosystem", "Packages"],
        [[kind, md.num(count)] for kind, count in kinds.most_common()],
        align="lr",
    )
    return f"### Packages\n\n{body}\n"


def build(root: str, command: str, exclude: set[str]) -> str:
    files, dir_count = scan(root, exclude, MAX_BYTES)
    if not files:
        return "# Codebase Statistics\n\nNo files found under the scanned path.\n"
    repos = gitinfo.collect(root)
    paths = [f.path for f in files]
    tests = {f.path for f in files if f.is_test}
    found = pkgs.discover(root, paths, tests)

    extras: list[tuple[str, str]] = []
    if found:
        extras.append(["Packages (manifests found)", md.num(len(found))])
    if repos:
        label = "Git repositories (super + nested)" if len(repos) > 1 else "Git repository"
        extras.append([label, md.num(len(repos))])

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    header = [
        "# Codebase Statistics",
        "",
        f"> `{os.path.basename(os.path.abspath(root)) or root}` - generated {stamp} - `{command}`",
        "",
        "Derived from the five universal axes of the pattern-derivation axis",
        "(`.claude/intel/reference_pattern_ontology.md`), with the codebase as the entity under analysis.",
        "",
        md.table(
            ["Axis", "Question", "What it measures here"],
            [[a, q, w] for a, q, w in AXES],
            align="lll",
        ),
        "",
        "",
    ]
    body = [
        sec_entities.existence(files, dir_count, extras),
        sec_entities.arrangement(files),
        sec_analysis.dynamics(repos),
        sec_analysis.interaction(found),
        sec_analysis.abstraction(files, found, [_packages_section(found), _memory_section(root)]),
    ]
    return "\n".join(header) + "\n".join(part for part in body if part.strip()) + "\n"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="codebase_stats", description=__doc__)
    parser.add_argument("path", nargs="?", default=".", help="repository root (default: cwd)")
    parser.add_argument("-o", "--output", default="CODEBASE-STATS.md", help="output file")
    parser.add_argument("--stdout", action="store_true", help="print instead of writing")
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        metavar="NAME",
        help="directory name to skip anywhere in the tree (repeatable)",
    )
    args = parser.parse_args(argv)

    root = os.path.abspath(args.path)
    if not os.path.isdir(root):
        print(f"not a directory: {root}", file=sys.stderr)
        return 2
    exclude = {name.strip("/\\") for name in args.exclude if name.strip("/\\")}
    shown = " ".join(f"--exclude {name}" for name in sorted(exclude))
    command = " ".join(
        part for part in ("python .claude/scripts/codebase_stats", args.path, shown) if part
    )
    report = build(root, command, exclude)
    if args.stdout:
        sys.stdout.write(report)
        return 0
    target = args.output if os.path.isabs(args.output) else os.path.join(root, args.output)
    with open(target, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(report)
    print(f"wrote {target} ({len(report.splitlines()):,} lines)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
