"""Build the frenzy overhaul bench: the event, team and staff candidates in the Monogram skin.

Run: python previews/frenzy/render.py
The generated HTML is output. Edit the Python parts and src/ and run this again.
"""

import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
THEME = HERE.parent / "site-theme"
sys.path.insert(0, str(THEME))

import data  # noqa: E402
import options  # noqa: E402
from class_report import print_report  # noqa: E402

WEB = HERE.parents[1] / "web-app"
WIDTHS = [("wide", 1280), ("medium", 768), ("phone", 390)]
THEME_SHEETS = ["components.css", "pages.css", "data-pages.css", "theme-mark.css", "theme-mark-pages.css",
                "theme-mark-data.css"]
SHEETS = ["product.css", *THEME_SHEETS, "frenzy.css", "theme-mark-frenzy.css"]
ART = ["IF_YELLOW.png", "IF_GREEN.png", "IF_PURPLE.png", "IF_ELECTRIC_BLUE.png", "LogoTSPSmall-320x320.png"]
ICON_SVG = (
    '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{}</svg>'
)
MODES = [("", "theme-mark"), ("-light", "theme-mark light")]


def copy_sources() -> None:
    sheets = sorted((WEB / "dist").glob("chunk-*.css"), key=lambda p: p.stat().st_mtime)
    if not sheets:
        raise SystemExit("web-app/dist has no compiled stylesheet. Run the web-app build first.")
    shutil.copyfile(sheets[-1], HERE / "product.css")
    for name in THEME_SHEETS:
        shutil.copyfile(THEME / name, HERE / name)
    (HERE / "art").mkdir(exist_ok=True)
    for name in ART:
        shutil.copyfile(THEME / "art" / name, HERE / "art" / name)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def fill(template: str, values: dict[str, str]) -> str:
    def value(match: re.Match[str]) -> str:
        key = match.group(1)
        return values.get(key, "") if key.startswith(("on_", "sec_", "row_")) else values[key]

    return re.sub(r"\{\{([\w-]+)\}\}", value, template)


def shell(option: dict, theme: str, signed_in: bool) -> str:
    marks = {"theme": theme, "content": option["html"], "account": "is-signed-in" if signed_in else ""}
    if option["public"]:
        marks |= {"sec_community": "is-active", "row_community": "is-current", "on_frenzy": "is-active"}
    return fill(read(THEME / "src" / "shell.html"), marks)


def with_icons(html: str, icons: dict[str, str]) -> str:
    return re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: ICON_SVG.format(icons[m.group(1)]), html)


def frame_name(option: dict, suffix: str = "") -> str:
    return f"frame-{option['surface']}-{option['id']}{suffix}.html"


def write_frames(all_options: list[dict], icons: dict[str, str]) -> list[Path]:
    template = read(THEME / "src" / "frame.html")
    links = "".join(f'<link rel="stylesheet" href="{s}">' for s in SHEETS)
    written = []
    for option in all_options:
        for suffix, theme in MODES:
            signed_in = not (option["public"] and suffix)
            body = shell(option, theme, signed_in)
            html = fill(template, {"title": option["name"], "sheets": links, "body_class": "", "body": body})
            path = HERE / frame_name(option, suffix)
            path.write_text(with_icons(html, icons), encoding="utf-8")
            written.append(path)
    return written


def bench_row(option: dict) -> str:
    src = option.get("src") or frame_name(option)
    shots = "".join(
        f'<figure class="bench-shot" data-bench-size="{view}"><figcaption class="text-muted-foreground text-xs">'
        f'{px} px</figcaption><iframe title="{option["name"]} at {px} px" src="{src}" width="{px}" height="900">'
        f"</iframe></figure>"
        for view, px in WIDTHS
    )
    light = "" if option.get("src") else (
        f'<p class="text-sm"><a class="text-primary underline" href="{frame_name(option, "-light")}">Light mode</a></p>'
    )
    return (
        f'<tr><th class="bench-label"><p class="font-rs-bold text-primary bench-name">{option["name"]}</p>'
        f'<p class="text-muted-foreground text-sm">{option["note"]}</p>{light}</th>'
        f'<td><div class="bench-widths">{shots}</div></td></tr>'
    )


def write_index(sections: dict[str, list[dict]]) -> Path:
    page = read(HERE / "src" / "index.html")
    for surface, rows in sections.items():
        page = page.replace(f"{{{{{surface}}}}}", "".join(bench_row(o) for o in rows))
    path = HERE / "index.html"
    path.write_text(page, encoding="utf-8")
    return path


def main() -> None:
    rows = data.load(HERE)
    art = data.load_source_art(HERE, rows) | data.load_group_art(HERE)
    copy_sources()
    sections = options.sections(rows, art)
    drawn = [o for rows_ in sections.values() for o in rows_ if not o.get("src")]
    frames = write_frames(drawn, json.loads(read(THEME / "src" / "icons.json")))
    index = write_index(sections)
    print_report([HERE / s for s in SHEETS] + [HERE / "bench.css"], frames + [index])
    print(f"wrote {len(frames)} frames and {index.name}")


if __name__ == "__main__":
    main()
