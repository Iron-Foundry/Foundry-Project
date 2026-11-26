"""The product controls and rate figures that the loot-rates bench frames share.

Each class string is the product component's own, merged with the override that
the real call site passes, so a drawn control matches the shipped one.
"""

import json
from html import escape
from pathlib import Path

ICONS = json.loads(
    (Path(__file__).resolve().parent.parent / "site-theme" / "src" / "icons.json").read_text(
        encoding="utf-8"
    )
)
SVG = (
    '<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>'
)

INPUT_XS = (
    "border-input h-6 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 "
    "text-xs shadow-xs outline-none"
)
INPUT_SM = (
    "border-input h-8 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 "
    "text-sm shadow-xs outline-none"
)
LABEL_XS = "flex items-center gap-1 leading-none font-medium text-[10px] text-muted-foreground"
LABEL = "flex items-center gap-2 leading-none font-medium text-xs text-muted-foreground"
BUTTON = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium shrink-0"
GHOST_ICON = f"{BUTTON} hover:bg-accent hover:text-accent-foreground h-7 w-7"
OUTLINE_SM = f"{BUTTON} border bg-background shadow-xs hover:bg-accent h-6 px-2 text-xs"
PRIMARY_SM = f"{BUTTON} bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
SELECT = (
    "border-input flex w-full items-center justify-between gap-2 rounded-md border "
    "bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs h-8"
)
SELECT_CONTENT = "bg-popover text-popover-foreground relative z-50 overflow-y-auto rounded-md border shadow-md p-1"
SELECT_ITEM = "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm"
OVERLAY = "fixed inset-0 z-50 bg-black/50"
DIALOG = (
    "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] "
    "translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg"
)


def icon(name: str, cls: str = "h-3 w-3") -> str:
    return SVG.format(cls=cls, body=ICONS[name])


def item_image(row: dict, cls: str = "h-5 w-5 object-contain shrink-0") -> str:
    return f'<img src="art/{row["itemId"]}.webp" alt="{escape(row["itemName"])}" class="{cls}">'


def chance_of(row: dict) -> float | None:
    return row.get("chancePerRaid") or row.get("chance")


def drop_denom(row: dict) -> int | None:
    chance = chance_of(row)
    return round(1 / chance) if chance else None


def hours_per_drop(row: dict) -> float | None:
    chance, kph = chance_of(row), row.get("killsPerHour")
    return 1 / (chance * kph) if chance and kph else None


def by_hours(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda r: (hours_per_drop(r) is None, hours_per_drop(r) or 0))


def denom_label(row: dict) -> str:
    denom = drop_denom(row)
    return f"1/{denom:,}" if denom else "-"


def hours_label(row: dict) -> str:
    hours = hours_per_drop(row)
    return f"{hours:,.1f} h" if hours is not None else "-"


def kph_label(row: dict) -> str:
    kph = row.get("killsPerHour")
    return f"{kph:g}" if kph is not None else "-"


def measurer(row: dict) -> str:
    names = {"wom": "WOM", "droptracker": "DropTracker", "clue_scroll": "Clue scroll",
             "item_drop": "Item drop", "superior": "Superior", "fixed": "Fixed",
             "foundry": "Foundry"}
    return names.get(row.get("killRateSource") or "", "No rate")


def source_name(row: dict) -> str:
    return escape(row["source"].replace("#", ", "))


def quantity_label(line: dict) -> str:
    low, high = line.get("quantityLow"), line.get("quantityHigh")
    text = line["quantity"] if low is None else (f"{low:g}" if low == high else f"{low:g}-{high:g}")
    return f"{text} (noted)" if line.get("noted") else text
