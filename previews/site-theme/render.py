"""Build the site-theme bench page from src/ and report classes and tokens no stylesheet defines.

Run: python previews/site-theme/render.py
The generated HTML is output. Edit src/ and run this again; never edit the HTML.
"""

import json
import re
import shutil
from pathlib import Path

from class_report import print_report

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
WEB = HERE.parents[1] / "web-app"
ART = [
    "BannerLogo-160x87.png", "LogoTSPSmall-320x320.png", "LogoTSPSmall-B&W-320x320.png",
    "clan-photo.png", "Sapphire256.png", "Emerald256.png", "Ruby256.png",
    "Diamond256.png", "Dragonstone256.png", "Onyx256.png", "Zenyte256.png",
    "IF_PURPLE.png", "IF_ELECTRIC_BLUE.png", "IF_GREEN.png", "IF_YELLOW.png",
]
SECTIONS = ["foundry", "community", "resources", "members"]
STYLESHEETS = ["product.css", "components.css", "bench.css"]
ICON_SVG = (
    '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{}</svg>'
)
NOT_DRAWN = (
    '<div class="flex flex-col gap-2 p-6"><p class="font-rs-bold text-primary text-lg">Not drawn</p>'
    '<p class="text-muted-foreground text-sm">Today\'s version of this page is the live route {}.</p></div>'
)


def newest_compiled_css() -> Path:
    sheets = sorted((WEB / "dist").glob("chunk-*.css"), key=lambda p: p.stat().st_mtime)
    if not sheets:
        raise SystemExit("web-app/dist has no compiled stylesheet. Run the web-app build first.")
    return sheets[-1]


def copy_sources() -> None:
    shutil.copyfile(newest_compiled_css(), HERE / "product.css")
    (HERE / "art").mkdir(exist_ok=True)
    for name in ART:
        shutil.copyfile(WEB / "src" / "assets" / name, HERE / "art" / name)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def fill(template: str, values: dict[str, str]) -> str:
    # A page-mark placeholder for a page not on the bench yet renders unmarked.
    def value(match: re.Match[str]) -> str:
        key = match.group(1)
        return values.get(key, "") if key.startswith("on_") else values[key]

    return re.sub(r"\{\{([\w-]+)\}\}", value, template)


def with_icons(html: str, icons: dict[str, str]) -> str:
    return re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: ICON_SVG.format(icons[m.group(1)]), html)


def section_marks(page: dict, active_class: str) -> dict[str, str]:
    return {f"sec_{s}": active_class if s == page["section"] else "" for s in SECTIONS}


def baseline_body(page: dict) -> str:
    source = SRC / "baseline" / f"{page['id']}.html"
    if not source.exists():
        return NOT_DRAWN.format(page["path"])
    topnav = fill(read(SRC / "baseline" / "topnav.html"), section_marks(page, "text-primary!"))
    return fill(read(source), {"topnav": topnav})


def frame_body(theme: dict, page: dict) -> str:
    if theme["id"] == "baseline":
        return baseline_body(page)
    marks = {f"on_{page['id']}": "is-active"}
    marks |= section_marks(page, "is-active")
    marks |= {f"row_{s}": "is-current" if s == page["section"] else "" for s in SECTIONS}
    marks["account"] = "is-signed-in" if page["signed_in"] else ""
    content = read(SRC / "pages" / f"{page['id']}.html")
    return fill(read(SRC / "shell.html"), {"theme": theme["class"], "content": content, **marks})


def frame_name(theme_id: str, page_id: str) -> str:
    return f"frame-{theme_id}-{page_id}.html"


def write_frames(themes: list[dict], pages: list[dict], icons: dict[str, str]) -> list[Path]:
    template = read(SRC / "frame.html")
    written = []
    for theme in themes:
        sheets = "".join(f'<link rel="stylesheet" href="{s}">' for s in theme["css"])
        for page in pages:
            html = fill(template, {
                "title": f"{theme['name']} - {page['label']}",
                "sheets": sheets,
                "body_class": theme["body_class"],
                "body": frame_body(theme, page),
            })
            path = HERE / frame_name(theme["id"], page["id"])
            path.write_text(with_icons(html, icons), encoding="utf-8")
            written.append(path)
    return written


def bench_row(theme: dict, first_page: str) -> str:
    return fill(read(SRC / "row.html"), {
        "id": theme["id"], "name": theme["name"], "note": theme["note"],
        "first": frame_name(theme["id"], first_page),
    })


def write_index(themes: list[dict], pages: list[dict]) -> Path:
    tabs = "".join(
        f'<button type="button" class="bench-tab" data-page="{p["id"]}">{p["label"]}</button>' for p in pages
    )
    rows = "".join(bench_row(t, pages[0]["id"]) for t in themes)
    path = HERE / "index.html"
    path.write_text(fill(read(SRC / "index.html"), {"tabs": tabs, "rows": rows}), encoding="utf-8")
    return path


def main() -> None:
    themes = json.loads(read(SRC / "themes.json"))
    pages = json.loads(read(SRC / "pages.json"))
    icons = json.loads(read(SRC / "icons.json"))
    copy_sources()
    frames = write_frames(themes, pages, icons)
    index = write_index(themes, pages)
    css_files = sorted({HERE / s for t in themes for s in t["css"]} | {HERE / s for s in STYLESHEETS})
    print_report(css_files, frames + [index])
    print(f"wrote {len(frames)} frames and {index.name}")


if __name__ == "__main__":
    main()
