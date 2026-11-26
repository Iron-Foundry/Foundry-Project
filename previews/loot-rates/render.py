"""Build the loot-rates bench page: the frenzy item editor and the reference page options.

Run: python previews/loot-rates/render.py
The generated HTML is output. Edit the Python parts and src/ and run this again.
"""

import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "site-theme"))

import data  # noqa: E402
import editor_frames  # noqa: E402
import killrate_frames  # noqa: E402
import reference_frames  # noqa: E402
from class_report import print_report  # noqa: E402

WEB = HERE.parents[1] / "web-app"
WIDTHS = [("wide", 1280), ("medium", 768), ("phone", 390)]
FRAME = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
    '<title>{title}</title><link rel="stylesheet" href="product.css"></head>'
    '<body class="bg-background text-foreground">{body}</body></html>'
)


def copy_stylesheet() -> None:
    sheets = sorted((WEB / "dist").glob("chunk-*.css"), key=lambda p: p.stat().st_mtime)
    if not sheets:
        raise SystemExit("web-app/dist has no compiled stylesheet. Run the web-app build first.")
    shutil.copyfile(sheets[-1], HERE / "product.css")


def write_frames(surface: str, options: list[dict]) -> list[Path]:
    written = []
    for option in options:
        path = HERE / f"frame-{surface}-{option['id']}.html"
        path.write_text(FRAME.format(title=option["name"], body=option["html"]), encoding="utf-8")
        written.append(path)
    return written


def bench_row(surface: str, option: dict) -> str:
    src = f"frame-{surface}-{option['id']}.html"
    shots = "".join(
        f'<figure class="bench-shot" data-bench-size="{view}"><figcaption class="text-muted-foreground text-xs">'
        f'{px} px</figcaption><iframe title="{option["name"]} at {px} px" src="{src}" width="{px}" height="900">'
        f"</iframe></figure>"
        for view, px in WIDTHS
    )
    return (
        f'<tr><th class="bench-label"><p class="font-rs-bold text-primary bench-name">{option["name"]}</p>'
        f'<p class="text-muted-foreground text-sm">{option["note"]}</p></th>'
        f'<td><div class="bench-widths">{shots}</div></td></tr>'
    )


def write_index(sections: dict[str, list[dict]]) -> Path:
    page = (HERE / "src" / "index.html").read_text(encoding="utf-8")
    for surface, options in sections.items():
        page = page.replace(f"{{{{{surface}}}}}", "".join(bench_row(surface, o) for o in options))
    path = HERE / "index.html"
    path.write_text(page, encoding="utf-8")
    return path


def main() -> None:
    rows = data.load(HERE)
    copy_stylesheet()
    sections = {
        "killrate": killrate_frames.options(rows),
        "editor": editor_frames.options(rows),
        "reference": reference_frames.options(rows),
    }
    frames = [p for surface, options in sections.items() for p in write_frames(surface, options)]
    index = write_index(sections)
    print_report([HERE / "product.css", HERE / "bench.css"], frames + [index])
    print(f"wrote {len(frames)} frames and {index.name}")


if __name__ == "__main__":
    main()
