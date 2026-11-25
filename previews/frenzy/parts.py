"""The small pieces every frenzy bench frame shares: icons, item images, rate figures and bars."""

import json
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
ICONS = json.loads((HERE.parent / "site-theme" / "src" / "icons.json").read_text(encoding="utf-8"))
ICONS["info"] = '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
SVG = (
    '<svg class="ui-icon{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>'
)
TIER_NAMES = ["Easy", "Medium", "Hard", "Elite"]
MEASURERS = {"wom": "WOM", "droptracker": "DropTracker", "clue_scroll": "Clue scroll",
             "item_drop": "Item drop", "superior": "Superior", "fixed": "Fixed"}


def ic(name: str, cls: str = "") -> str:
    return SVG.format(cls=f" {cls}" if cls else "", body=ICONS[name])


def n(value: float) -> str:
    return f"{value:,.0f}"


def item_img(item: dict) -> str:
    return f'<img src="art/{item["item_id"]}.webp" alt="{escape(item["name"])}">'


def team_img(team: dict) -> str:
    if not team["icon"]:
        return f'<span class="fz-noicon" role="img" aria-label="{escape(team["name"])} has no icon"></span>'
    return f'<img src="art/{team["icon"]}" alt="{escape(team["name"])} team icon">'


def team_link(team: dict) -> str:
    return f'<a class="fz-team" href="#">{team_img(team)}<b>{escape(team["name"])}</b></a>'


def hours_label(item: dict) -> str:
    return f'{item["hours"]:,.1f} h' if item["hours"] is not None else "No rate"


def denom_label(item: dict) -> str:
    return f'1/{item["denom"]:,}' if item["denom"] else "-"


def kph_label(item: dict) -> str:
    return f'{item["kph"]:g}/h' if item["kph"] is not None else "-"


def measurer(item: dict) -> str:
    return MEASURERS.get(item["measurer"] or "", "No rate")


def rate_text(item: dict) -> str:
    if item["hours"] is None:
        return f'{escape(item["source"])} has no kill rate'
    return f'{denom_label(item)} · {kph_label(item)} ({measurer(item)}) · {hours_label(item)} a drop'


def tier_bar(points: list[float], total: float | None = None) -> str:
    whole = total or sum(points) or 1
    segments = "".join(
        f'<i class="ui-tier-{i + 1}" style="width: {p / whole * 100:.1f}%" title="{TIER_NAMES[i]}: {n(p)} pts"></i>'
        for i, p in enumerate(points) if p
    )
    return f'<div class="fz-bar">{segments}</div>'


def pips(have: int, need: int) -> str:
    dots = "".join(f'<i class="{"on" if i < have else ""}"></i>' for i in range(min(need, 8)))
    return f'<span class="ui-pips" title="{have}/{need}">{dots}</span>'


def track(current: float, tiers: list[float]) -> str:
    cells = "".join(f'<i class="{"on" if current >= t else ""}"></i>' for t in tiers)
    labels = "".join(f"<span>{short(t)}</span>" for t in tiers)
    return f'<div class="fz-track">{cells}</div><div class="fz-track-labels">{labels}</div>'


def short(value: float) -> str:
    if value >= 1_000_000:
        return f"{value / 1_000_000:g}m"
    return f"{value / 1000:g}k" if value >= 1000 else f"{value:g}"


def tier_legend() -> str:
    spans = "".join(f'<span><i class="fz-dot ui-tier-{i + 1}"></i>{t}</span>' for i, t in enumerate(TIER_NAMES))
    return f'<div class="fz-legend">{spans}</div>'


def tool(label: str, icon_name: str = "", cls: str = "ui-tool") -> str:
    return f'<button type="button" class="{cls}">{ic(icon_name) if icon_name else ""}{label}</button>'


def select(label: str, cls: str = "ui-select ui-select--small") -> str:
    return f'<button type="button" class="{cls}">{label}{ic("chevron-down")}</button>'


def filterline(kicker: str, options: list[str], active: str) -> str:
    buttons = "".join(f'<button type="button" class="{"is-active" if o == active else ""}">{o}</button>' for o in options)
    return f'<div class="ui-filterline"><span class="ui-kicker">{kicker}</span>{buttons}</div>'


def tabs(names: list[str], active: str) -> str:
    links = "".join(f'<a class="ui-tab{" is-active" if t == active else ""}" href="#">{t}</a>' for t in names)
    return f'<nav class="ui-tabs" aria-label="Sections">{links}</nav>'
