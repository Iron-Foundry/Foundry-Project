"""The pieces of the reference page that today and the candidates share."""

from html import escape

from parts import (
    INPUT_SM, hours_label, icon, item_image, kph_label, measurer, quantity_label, source_name,
)

TODAY_TABS = ["Bosses", "Activities", "Clues", "Rates"]
NEW_TABS = ["Raids", "Bosses", "Minigames", "Clues", "Skilling", "Monsters", "Rates"]
HEAD = "px-3 py-2 text-xs font-medium text-muted-foreground"
CELL = "px-3 py-2"
SMALL_HEAD = "text-[10px] uppercase tracking-wider text-muted-foreground/50"
SMALL_CELL = "py-1.5 px-2 text-right tabular-nums text-muted-foreground"


def page_head() -> str:
    return (
        '<div><h2 class="font-rs-bold text-2xl text-primary">Reference Data</h2>'
        '<p class="text-sm text-muted-foreground">Read-only loot tables sourced from the OSRS Wiki '
        "and Ironman efficiency rates from WiseOldMan. Select a source to view its full drop table.</p></div>"
    )


def tabs(names: list[str], active: str) -> str:
    base = "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap"
    on = f"{base} text-foreground border-primary"
    off = f"{base} text-muted-foreground border-transparent hover:text-foreground"
    buttons = "".join(f'<button class="{on if n == active else off}">{n}</button>' for n in names)
    return f'<div class="border-b border-border overflow-x-auto"><div class="flex -mb-px">{buttons}</div></div>'


def search(placeholder: str, value: str = "") -> str:
    return (
        f'<div class="relative">{icon("search", "absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground")}'
        f'<input class="{INPUT_SM} pl-8" placeholder="{placeholder}" value="{escape(value)}"></div>'
    )


def chance_percent(row: dict) -> str:
    chance = row.get("chance")
    if not chance:
        return "-"
    pct = chance * 100
    return "100%" if pct >= 100 else f"{pct:.3f}%" if pct < 0.1 else f"{pct:.2f}%" if pct < 1 else f"{pct:.1f}%"


def grouped(rows: list[dict]) -> list[tuple[str, list[dict]]]:
    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(row.get("group") or "Drops", []).append(row)
    return list(groups.items())


def drop_table(rows: list[dict], with_hours: bool) -> str:
    cols = ["Item", "Qty", "Rarity", "Chance/kill"] + (["Hours a drop"] if with_hours else []) + ["GE"]
    head = "".join(
        f'<th class="py-1 {"pr-2 text-left" if c == "Item" else "px-2 text-right"} font-medium">{c}</th>'
        for c in cols
    )
    blocks = []
    for group, members in grouped(rows):
        body = "".join(drop_row(row, with_hours) for row in members)
        blocks.append(
            f'<div><p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">'
            f'{escape(group)}</p><table class="w-full text-xs"><thead><tr class="{SMALL_HEAD}">{head}</tr>'
            f'</thead><tbody class="divide-y divide-border/50">{body}</tbody></table></div>'
        )
    return "".join(blocks)


def drop_row(row: dict, with_hours: bool) -> str:
    line = row["lines"][0]
    image = item_image(row, "h-4 w-4 object-contain shrink-0") if with_hours and row.get("itemId") else ""
    price = f'{row["gePrice"]:,} gp' if row.get("gePrice") is not None else "-"
    hours = f'<td class="{SMALL_CELL}">{hours_label(row)}</td>' if with_hours else ""
    return (
        f'<tr><td class="py-1.5 pr-2"><span class="flex items-center gap-1.5">{image}'
        f'{escape(row["itemName"])}</span></td><td class="{SMALL_CELL}">{escape(quantity_label(line))}</td>'
        f'<td class="{SMALL_CELL}">{escape(line["rarity"])}</td><td class="{SMALL_CELL}">{chance_percent(row)}</td>'
        f'{hours}<td class="py-1.5 pl-2 text-right tabular-nums text-muted-foreground">{price}</td></tr>'
    )


def source_cells(source: dict) -> str:
    return (
        f'<td class="{CELL} text-right tabular-nums">{kph_label(source)}</td>'
        f'<td class="{CELL} text-muted-foreground">{measurer(source)}</td>'
        f'<td class="{CELL} text-right tabular-nums text-muted-foreground">{source["rows"]}</td>'
    )


def source_head() -> str:
    return (
        f'<tr><th class="{HEAD} text-left">Source</th><th class="{HEAD} text-right">Kills/h</th>'
        f'<th class="{HEAD} text-left">Measured by</th>'
        f'<th class="{HEAD} text-right">Rows</th></tr>'
    )
