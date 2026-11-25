"""The reference page options: today, and three layouts on the OSRSClans routes."""

from html import escape

from parts import (
    DIALOG, OVERLAY, SELECT, by_hours, denom_label, hours_label, icon, item_image, kph_label,
    measurer, source_name,
)
from reference_parts import (
    CELL, HEAD, NEW_TABS, TODAY_TABS, drop_table, page_head, search, source_cells, source_head, tabs,
)

VORKATH = "Vorkath#Post-quest"
TABLE = "overflow-x-auto rounded-md border border-border"
THEAD = "border-b border-border bg-muted/30"


def wrap(body: str) -> str:
    return f'<div class="mx-auto max-w-5xl space-y-4 p-4">{body}</div>'


def today(data: dict) -> str:
    rows = []
    for source in data["bosses"]:
        is_open = source["source"] == VORKATH
        chevron = icon("chevron-down" if is_open else "chevron-right", "h-3.5 w-3.5 shrink-0 text-muted-foreground")
        rows.append(
            f'<tr class="cursor-pointer hover:bg-muted/20"><td class="{CELL}"><span class="flex items-center gap-2">'
            f'{chevron}{escape(source["page"])}</span></td><td class="{CELL} text-right tabular-nums text-muted-foreground">'
            f'{source["rows"]}</td><td class="{CELL} text-right text-xs text-muted-foreground">25/11/2026</td></tr>'
        )
        if is_open:
            rows.append(f'<tr><td colspan="3" class="p-0"><div class="space-y-3 bg-muted/20 p-3">'
                        f'{drop_table(data["vorkath"], False)}</div></td></tr>')
    head = (f'<tr><th class="{HEAD} text-left">Source</th><th class="{HEAD} text-right">Drops</th>'
            f'<th class="{HEAD} text-right">Updated</th></tr>')
    table = (f'<div class="{TABLE}"><table class="w-full text-sm"><thead class="{THEAD}">{head}</thead>'
             f'<tbody class="divide-y divide-border">{"".join(rows)}</tbody></table></div>')
    return wrap(page_head() + tabs(TODAY_TABS, "Bosses") + table)


def section_tag(source: dict) -> str:
    if not source["section"]:
        return ""
    return f'<span class="text-xs text-muted-foreground">{escape(source["section"])}</span>'


def source_table(sources: list[dict]) -> str:
    rows = "".join(
        f'<tr class="cursor-pointer hover:bg-muted/20"><td class="{CELL}">'
        f'<span class="flex items-center gap-2">{escape(s["page"])}{section_tag(s)}</span></td>'
        f"{source_cells(s)}</tr>"
        for s in sources
    )
    return (f'<div class="{TABLE}"><table class="w-full text-sm"><thead class="{THEAD}">{source_head()}</thead>'
            f'<tbody class="divide-y divide-border">{rows}</tbody></table></div>')


def source_facts(data: dict) -> str:
    source = next(s for s in data["bosses"] if s["source"] == VORKATH)
    return (f'{source["rows"]} rows · {kph_label(source)} kills/h ({measurer(source)}) · '
            f'read {data["vorkath"][0]["readAt"][:10]}')


def drop_dialog(data: dict) -> str:
    return (
        f'<div class="{OVERLAY}"></div><div class="{DIALOG} sm:max-w-2xl">'
        f'<div class="flex flex-col gap-2 text-center sm:text-left">'
        f'<h2 class="text-lg leading-none font-semibold">{source_name({"source": VORKATH})}</h2>'
        f'<p class="text-muted-foreground text-sm">{source_facts(data)}</p></div>'
        f'<div class="max-h-96 space-y-3 overflow-y-auto">{drop_table(data["vorkath"], True)}</div>'
        f'<button class="absolute top-4 right-4 rounded-xs opacity-70">{icon("x", "size-4")}</button></div>'
    )


def r1(data: dict, is_open: bool = False) -> str:
    body = page_head() + tabs(NEW_TABS, "Bosses") + search("Search sources or items")
    return wrap(body + source_table(data["bosses"])) + (drop_dialog(data) if is_open else "")


def r2(data: dict) -> str:
    items = "".join(
        f'<button class="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm '
        f'{"bg-muted" if s["source"] == VORKATH else "hover:bg-muted/50"}"><span class="truncate">'
        f'{source_name(s)}</span><span class="text-xs tabular-nums text-muted-foreground">{kph_label(s)}/h</span></button>'
        for s in data["bosses"]
    )
    rail = (f'<div class="space-y-2 lg:col-span-4"><button class="{SELECT}"><span>Bosses</span>'
            f'{icon("chevron-down", "size-4 opacity-50")}</button>{search("Search")}'
            f'<div class="rounded-md border border-border p-1">{items}</div></div>')
    detail = (f'<div class="space-y-3 rounded-md border border-border p-4 min-w-0 lg:col-span-8">'
              f'<div><p class="font-rs-bold text-lg text-primary">{source_name({"source": VORKATH})}</p>'
              f'<p class="text-xs text-muted-foreground">{source_facts(data)}</p></div>'
              f'{drop_table(data["vorkath"], True)}</div>')
    return wrap(page_head() + f'<div class="grid gap-4 lg:grid-cols-12">{rail}{detail}</div>')


def r3(data: dict) -> str:
    rows = "".join(
        f'<tr><td class="{CELL}"><span class="flex items-center gap-2">{item_image(r)}{escape(r["itemName"])}</span></td>'
        f'<td class="{CELL}">{source_name(r)}</td><td class="{CELL} text-right tabular-nums text-muted-foreground">'
        f'{denom_label(r)}</td><td class="{CELL} text-right tabular-nums text-muted-foreground">'
        f'{kph_label(r)}</td><td class="{CELL} text-right tabular-nums">{hours_label(r)}</td></tr>'
        for r in by_hours(data["search"])
    )
    head = (f'<tr><th class="{HEAD} text-left">Item</th><th class="{HEAD} text-left">Source</th>'
            f'<th class="{HEAD} text-right">Chance</th><th class="{HEAD} text-right">Kills/h</th>'
            f'<th class="{HEAD} text-right">Hours a drop</th></tr>')
    results = (f'<div class="{TABLE}"><table class="w-full text-sm"><thead class="{THEAD}">{head}</thead>'
               f'<tbody class="divide-y divide-border">{rows}</tbody></table></div>')
    browse = tabs(NEW_TABS, "Raids") + source_table(data["raids"])
    return wrap(page_head() + search("Search an item or a source", "visage") + results + browse)


def options(data: dict) -> list[dict]:
    return [
        {"id": "r1", "name": "R1 Tabs and a dialog", "note": "Today's shape with the OSRSClans categories as tabs, a search, and kill rates on each source. A source opens its drop table in a dialog.",
         "html": r1(data)},
        {"id": "r1-open", "name": "R1, Vorkath open", "note": "The drop table, grouped by the Wiki's own headings, with item images and hours a drop.",
         "html": r1(data, True)},
        {"id": "r2", "name": "R2 List and detail", "note": "A source list with a category dropdown on the left, the picked source's drop table on the right. Under 1024 px the table follows the list.",
         "html": r2(data)},
        {"id": "r3", "name": "R3 Item search first", "note": "One search over items and sources answers with loot rate rows, fastest first. The category tabs browse the sources below it.",
         "html": r3(data)},
        {"id": "today", "name": "Today", "note": "What ships today, on the Wiki scrape. Vorkath is open.",
         "html": today(data)},
    ]
