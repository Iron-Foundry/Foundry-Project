"""Package manifest discovery and the internal dependency graph."""

import json
import os
import re
from dataclasses import dataclass, field

try:
    import tomllib
except ModuleNotFoundError:
    tomllib = None

MANIFESTS = {
    "package.json": "node",
    "pyproject.toml": "python",
    "Cargo.toml": "rust",
    "go.mod": "go",
}

REQ_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*")
GO_MODULE = re.compile(r"^module\s+(\S+)", re.MULTILINE)
GO_REQUIRE = re.compile(r"^\s*(\S+)\s+v\S+", re.MULTILINE)


@dataclass
class Package:
    name: str
    path: str
    kind: str
    deps: list[str] = field(default_factory=list)
    has_readme: bool = False
    has_tests: bool = False


def _load_toml(full: str) -> dict:
    if tomllib is None:
        return {}
    try:
        with open(full, "rb") as handle:
            return tomllib.load(handle)
    except (OSError, ValueError):
        return {}


def _node(full: str) -> tuple[str, list[str]]:
    try:
        with open(full, encoding="utf-8", errors="replace") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return "", []
    if not isinstance(data, dict):
        return "", []
    deps: list[str] = []
    for key in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        block = data.get(key)
        if isinstance(block, dict):
            deps.extend(str(k) for k in block)
    return str(data.get("name") or ""), deps


def _poetry(data: dict) -> tuple[str, list[str]]:
    tool = data.get("tool") if isinstance(data.get("tool"), dict) else {}
    poetry = tool.get("poetry") if isinstance(tool.get("poetry"), dict) else {}
    if not poetry:
        return "", []
    blocks = [poetry.get("dependencies"), poetry.get("dev-dependencies")]
    groups = poetry.get("group")
    if isinstance(groups, dict):
        blocks.extend(g.get("dependencies") for g in groups.values() if isinstance(g, dict))
    deps: list[str] = []
    for block in blocks:
        if isinstance(block, dict):
            deps.extend(str(k) for k in block if k != "python")
    return str(poetry.get("name") or ""), deps


def _python(full: str) -> tuple[str, list[str]]:
    data = _load_toml(full)
    project = data.get("project") if isinstance(data.get("project"), dict) else {}
    if not project.get("name"):
        return _poetry(data)
    raw: list[str] = list(project.get("dependencies") or [])
    for block in (project.get("optional-dependencies"), data.get("dependency-groups")):
        if isinstance(block, dict):
            for group in block.values():
                if isinstance(group, list):
                    raw.extend(item for item in group if isinstance(item, str))
    deps = []
    for item in raw:
        match = REQ_NAME.match(str(item).strip())
        if match:
            deps.append(match.group(0))
    return str(project.get("name") or ""), deps


def _rust(full: str) -> tuple[str, list[str]]:
    data = _load_toml(full)
    package = data.get("package") if isinstance(data.get("package"), dict) else {}
    deps: list[str] = []
    for key in ("dependencies", "dev-dependencies", "build-dependencies"):
        block = data.get(key)
        if isinstance(block, dict):
            deps.extend(str(k) for k in block)
    return str(package.get("name") or ""), deps


def _go(full: str) -> tuple[str, list[str]]:
    try:
        with open(full, encoding="utf-8", errors="replace") as handle:
            text = handle.read()
    except OSError:
        return "", []
    module = GO_MODULE.search(text)
    return (module.group(1) if module else ""), GO_REQUIRE.findall(text)


PARSERS = {"node": _node, "python": _python, "rust": _rust, "go": _go}


def discover(root: str, paths: list[str], test_paths: set[str]) -> list[Package]:
    """Build a Package per manifest found in the scanned path list."""
    found: list[Package] = []
    by_dir: dict[str, set[str]] = {}
    for path in paths:
        parent = path.rsplit("/", 1)[0] if "/" in path else ""
        by_dir.setdefault(parent, set()).add(path.rsplit("/", 1)[-1].lower())

    for path in paths:
        filename = path.rsplit("/", 1)[-1]
        kind = MANIFESTS.get(filename)
        if kind is None:
            continue
        parent = path.rsplit("/", 1)[0] if "/" in path else ""
        name, deps = PARSERS[kind](os.path.join(root, path.replace("/", os.sep)))
        if not name:
            continue
        siblings = by_dir.get(parent, set())
        prefix = f"{parent}/" if parent else ""
        found.append(
            Package(
                name=name,
                path=parent or ".",
                kind=kind,
                deps=sorted(set(deps)),
                has_readme=any(s.startswith("readme") for s in siblings),
                has_tests=any(t.startswith(prefix) for t in test_paths),
            )
        )
    return found


def internal_edges(packages: list[Package]) -> list[tuple[str, str]]:
    known = {pkg.name for pkg in packages}
    edges: list[tuple[str, str]] = []
    for pkg in packages:
        for dep in pkg.deps:
            if dep in known and dep != pkg.name:
                edges.append((pkg.name, dep))
    return edges
