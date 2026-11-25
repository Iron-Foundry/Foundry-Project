"""The frenzy item editor options: today, and three ways to take a rate from OSRSClans."""

from collections.abc import Callable
from html import escape

from editor_rows import (
    item_row, rate_from_card, rate_line, rate_select, rate_select_open, rate_today,
)
from parts import (
    DIALOG, GHOST_ICON, INPUT_SM, INPUT_XS, LABEL, OUTLINE_SM, OVERLAY, by_hours, denom_label,
    hours_label, icon, kph_label, measurer, source_name,
)

EXAMPLES = [
    ("Vorkath", "visage", "Vorkath#Post-quest"),
    ("Chambers of Xeric", "tbow", "Ancient chest#Normal Mode"),
    ("Hallowed Sepulchre", "endurance", "Grand Hallowed Coffin"),
]


def chosen(data: dict, key: str, source: str) -> dict:
    return next(row for row in data[key] if row["source"] == source)


def card(name: str, items: str) -> str:
    return (
        f'<div class="rounded-lg border bg-card"><div class="flex items-center gap-2 p-2.5">'
        f'<button class="flex items-center gap-1.5 flex-1 text-left text-sm font-medium">'
        f'{icon("chevron-down", "h-3.5 w-3.5")}{escape(name)}'
        f'<span class="ml-1 text-xs text-muted-foreground">(1 items)</span></button>'
        f'<button class="{GHOST_ICON}">{icon("trash")}</button></div>'
        f'<div class="px-3 pb-3 space-y-2 border-t pt-2"><div class="space-y-1.5">'
        f'<label class="{LABEL}">Source (boss)</label><input class="{INPUT_SM}" value="{escape(name)}">'
        f'</div><div><label class="{LABEL}">Hover text</label>'
        f'<input class="{INPUT_XS} h-7" placeholder="Description shown on hover"></div>'
        f'<div class="space-y-1.5">{items}<button class="{OUTLINE_SM} w-full h-7">'
        f'{icon("plus")}Add Item</button></div></div></div>'
    )


def editor_page(data: dict, rate: Callable[[dict], str], extra: str = "") -> str:
    cards = "".join(
        card(name, item_row(chosen(data, key, source), rate(chosen(data, key, source))))
        for name, key, source in EXAMPLES
    )
    return f'<div class="mx-auto max-w-3xl space-y-2 p-4">{cards}</div>{extra}'


def change_dialog(data: dict) -> str:
    current = chosen(data, "visage", "Vorkath#Post-quest")
    rows = []
    for row in by_hours(data["visage"]):
        action = (
            '<span class="text-xs text-primary">In use</span>' if row is current
            else f'<button class="{OUTLINE_SM}">Use</button>'
        )
        rows.append(
            f'<tr><td class="py-1.5 pr-2">{source_name(row)}</td>'
            f'<td class="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{denom_label(row)}</td>'
            f'<td class="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{kph_label(row)}</td>'
            f'<td class="py-1.5 px-2 text-muted-foreground">{measurer(row)}</td>'
            f'<td class="py-1.5 px-2 text-right tabular-nums">{hours_label(row)}</td>'
            f'<td class="py-1.5 pl-2 text-right">{action}</td></tr>'
        )
    head = "".join(
        f'<th class="py-1 px-2 font-medium {align}">{name}</th>'
        for name, align in [("Source", "text-left"), ("Chance", "text-right"), ("Kills/h", "text-right"),
                            ("Measured by", "text-left"), ("Hours a drop", "text-right"), ("", "")]
    )
    return (
        f'<div class="{OVERLAY}"></div><div class="{DIALOG} sm:max-w-2xl">'
        f'<div class="flex flex-col gap-2 text-center sm:text-left">'
        f'<h2 class="text-lg leading-none font-semibold">Rate for Draconic visage</h2>'
        f'<p class="text-muted-foreground text-sm">{len(rows)} sources, fastest first.</p></div>'
        f'<div class="max-h-96 overflow-y-auto"><table class="w-full text-xs"><thead>'
        f'<tr class="text-[10px] uppercase tracking-wider text-muted-foreground/50">{head}</tr></thead>'
        f'<tbody class="divide-y divide-border/50">{"".join(rows)}</tbody></table></div>'
        f'<button class="absolute top-4 right-4 rounded-xs opacity-70">{icon("x", "size-4")}</button></div>'
    )


def select_open_page(data: dict) -> str:
    row = chosen(data, "visage", "Vorkath#Post-quest")
    menu = rate_select_open(data["visage"], row)
    return f'<div class="mx-auto max-w-3xl space-y-2 p-4">{card("Vorkath", item_row(row, rate_select(row, menu)))}</div>'


def options(data: dict) -> list[dict]:
    return [
        {"id": "e1", "name": "E1 Rate line", "note": "Each item shows the source row it takes its rate from. Change opens a dialog of all sources for the item, fastest first. The fields stay editable.",
         "html": editor_page(data, rate_line)},
        {"id": "e1-open", "name": "E1, Change open", "note": "The dialog for Draconic visage. Use takes that source's chance and kill rate.",
         "html": editor_page(data, rate_line, change_dialog(data))},
        {"id": "e2", "name": "E2 Rate select", "note": "A Rate source dropdown on each item. The figures read from the picked row. By hand turns them back into fields.",
         "html": editor_page(data, rate_select)},
        {"id": "e2-open", "name": "E2, dropdown open", "note": "The dropdown lists all sources for the item, fastest first.",
         "html": select_open_page(data)},
        {"id": "e3", "name": "E3 From the card", "note": "The rate comes from the card's own source. No control per item. The pencil sets a rate by hand.",
         "html": editor_page(data, rate_from_card)},
        {"id": "today", "name": "Today", "note": "What ships today: drop denom and KPH typed by hand.",
         "html": editor_page(data, rate_today)},
    ]
