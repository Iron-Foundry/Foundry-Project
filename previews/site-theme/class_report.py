"""Report the classes and the custom properties that no bench stylesheet defines."""

import re
from pathlib import Path


def selector_classes(css: str) -> set[str]:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"url\([^)]*\)", "", css)
    names = re.findall(r"\.((?:\\.|[A-Za-z0-9_-])+)", css)
    return {re.sub(r"\\(.)", r"\1", n) for n in names}


def page_classes(html: str) -> set[str]:
    found: set[str] = set()
    for value in re.findall(r'class="([^"]*)"', html):
        found.update(value.split())
    return found


def undefined_tokens(css_files: list[Path]) -> set[str]:
    own = "".join(p.read_text(encoding="utf-8") for p in css_files if p.name != "product.css")
    every = "".join(p.read_text(encoding="utf-8") for p in css_files)
    used = set(re.findall(r"var\((--[\w-]+)", own))
    defined = set(re.findall(r"(--[\w-]+)\s*:", every))
    return used - defined


def print_report(css_files: list[Path], pages: list[Path]) -> None:
    known = set().union(*(selector_classes(p.read_text(encoding="utf-8")) for p in css_files))
    used = set().union(*(page_classes(p.read_text(encoding="utf-8")) for p in pages))
    print(f"classes no stylesheet carries: {sorted(used - known) or 'none'}")
    print(f"tokens no stylesheet defines: {sorted(undefined_tokens(css_files)) or 'none'}")
