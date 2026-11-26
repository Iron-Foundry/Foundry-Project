"""Round 2: where staff set a Foundry kill rate on a source that OSRSClans gives none."""

from html import escape

from parts import (
    DIALOG, GHOST_ICON, INPUT_SM, OUTLINE_SM, OVERLAY, PRIMARY_SM, SELECT, icon, kph_label,
    measurer, source_name,
)
from reference_frames import TABLE, THEAD, today, wrap
from reference_parts import CELL, HEAD, NEW_TABS, drop_table, page_head, search, tabs

COFFIN = "Grand Hallowed Coffin"
OPEN_ROW = "Coffin (Hallowed Sepulchre)#Low"
MOCK_RATE = 6.0
SET_BY = "Hammer Time, 26 Nov 2026"
WARN = "text-yellow-500"
POPOVER = "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md"


def with_mock_rate(source: dict) -> dict:
    if source["source"] != COFFIN:
        return source
    return {**source, "killsPerHour": MOCK_RATE, "killRateSource": "foundry"}


def sources(data: dict) -> list[dict]:
    return [with_mock_rate(s) for s in data["hallowed"]]


def coffin_rows(data: dict) -> list[dict]:
    return [{**row, "killsPerHour": MOCK_RATE} for row in data["coffin"]]


def rate_cell(source: dict, is_open: bool) -> str:
    if source["killsPerHour"] is None:
        body = (f'<span class="{WARN}">No rate</span><button class="{OUTLINE_SM}">Set</button>')
    else:
        body = f'{kph_label(source)}<button class="{GHOST_ICON}">{icon("pencil", "size-3.5")}</button>'
    pop = rate_popover(source) if is_open else ""
    return (f'<td class="{CELL} text-right tabular-nums"><span class="inline-flex items-center '
            f'gap-2">{body}</span>{pop}</td>')


def rate_popover(source: dict) -> str:
    return (
        f'<div class="{POPOVER} absolute right-0 mt-1 space-y-3 text-left">'
        f'<p class="text-sm font-medium">Kills an hour</p><p class="text-xs text-muted-foreground">'
        f'OSRSClans gives no kill rate for {source_name(source)}.</p>'
        f'<input class="{INPUT_SM}" inputmode="decimal" placeholder="For example 12.5">'
        f'<div class="flex justify-end gap-2"><button class="{OUTLINE_SM}">Cancel</button>'
        f'<button class="{PRIMARY_SM}">Save</button></div></div>'
    )


def k1(data: dict, is_open: bool = False) -> str:
    rows = "".join(
        f'<tr class="hover:bg-muted/20"><td class="{CELL}">{source_name(s)}</td>'
        f'{rate_cell(s, is_open and s["source"] == OPEN_ROW)}'
        f'<td class="{CELL} text-muted-foreground">{measurer(s)}</td>'
        f'<td class="{CELL} text-right tabular-nums text-muted-foreground">{s["rows"]}</td></tr>'
        for s in sources(data)
    )
    head = (f'<tr><th class="{HEAD} text-left">Source</th><th class="{HEAD} text-right">Kills/h</th>'
            f'<th class="{HEAD} text-left">Measured by</th><th class="{HEAD} text-right">Rows</th></tr>')
    # The product popover renders in a portal and shifts into the window, so the open
    # frame drops the clipping wrapper and anchors the popover to the table's right edge.
    wrapper = "relative rounded-md border border-border" if is_open else TABLE
    table = (f'<div class="{wrapper}"><table class="w-full text-sm"><thead class="{THEAD}">{head}'
             f'</thead><tbody class="divide-y divide-border">{rows}</tbody></table></div>')
    return wrap(page_head() + tabs(NEW_TABS, "Skilling") + search("Search sources or items", "Hallowed") + table)


def read_only_rate(source: dict) -> str:
    rate = kph_label(source) if source["killsPerHour"] is not None else f'<span class="{WARN}">No rate</span>'
    return f'<td class="{CELL} text-right tabular-nums">{rate}</td>'


def k2(data: dict) -> str:
    rows = "".join(
        f'<tr class="cursor-pointer hover:bg-muted/20"><td class="{CELL}">{source_name(s)}</td>'
        f'{read_only_rate(s)}<td class="{CELL} text-muted-foreground">{measurer(s)}</td></tr>'
        for s in sources(data)
    )
    head = (f'<tr><th class="{HEAD} text-left">Source</th><th class="{HEAD} text-right">Kills/h</th>'
            f'<th class="{HEAD} text-left">Measured by</th></tr>')
    table = (f'<div class="{TABLE}"><table class="w-full text-sm"><thead class="{THEAD}">{head}</thead>'
             f'<tbody class="divide-y divide-border">{rows}</tbody></table></div>')
    page = wrap(page_head() + tabs(NEW_TABS, "Skilling") + search("Search sources or items", "Hallowed") + table)
    return page + coffin_dialog(data)


def coffin_dialog(data: dict) -> str:
    rate = (
        f'<div class="space-y-2 rounded-md border border-border p-3"><p class="text-sm font-medium">'
        f'Kill rate</p><p class="text-xs text-muted-foreground">OSRSClans gives none. Foundry rate, set by '
        f'{SET_BY}.</p><div class="flex items-center gap-2"><input class="{INPUT_SM} w-28" '
        f'value="{MOCK_RATE:g}"><span class="text-sm text-muted-foreground">an hour</span>'
        f'<span class="flex-1"></span><button class="{OUTLINE_SM}">Remove</button>'
        f'<button class="{PRIMARY_SM}">Save</button></div></div>'
    )
    return (
        f'<div class="{OVERLAY}"></div><div class="{DIALOG} sm:max-w-2xl">'
        f'<div class="flex flex-col gap-2 text-center sm:text-left"><h2 class="text-lg leading-none '
        f'font-semibold">{escape(COFFIN)}</h2><p class="text-muted-foreground text-sm">'
        f'{len(data["coffin"])} rows · read {data["coffin"][0]["readAt"][:10]}</p></div>{rate}'
        f'<div class="max-h-72 space-y-3 overflow-y-auto">{drop_table(coffin_rows(data), True)}</div>'
        f'<button class="absolute top-4 right-4 rounded-xs opacity-70">{icon("x", "size-4")}</button></div>'
    )


def k3_row(source: dict) -> str:
    is_set = source["killRateSource"] == "foundry"
    value = f' value="{source["killsPerHour"]:g}"' if is_set else ""
    remove = f'<button class="{OUTLINE_SM}">Remove</button>' if is_set else ""
    who = SET_BY if is_set else "-"
    return (
        f'<tr><td class="{CELL}">{source_name(source)}</td><td class="{CELL} text-muted-foreground">'
        f'{escape(source["category"] or "-")}</td><td class="{CELL}"><input class="{INPUT_SM} w-24"'
        f'{value} placeholder="Kills/h"></td><td class="{CELL} text-xs text-muted-foreground">{who}</td>'
        f'<td class="{CELL}"><span class="flex justify-end gap-2">{remove}'
        f'<button class="{OUTLINE_SM}">Save</button></span></td></tr>'
    )


def k3(data: dict) -> str:
    filters = (f'<div class="flex flex-wrap items-center gap-2"><button class="{SELECT} w-44">'
               f'<span>No OSRSClans rate</span>{icon("chevron-down", "size-4 opacity-50")}</button>'
               f'<div class="min-w-0 flex-1">{search("Search sources", "Hallowed")}</div></div>')
    head = (f'<tr><th class="{HEAD} text-left">Source</th><th class="{HEAD} text-left">Category</th>'
            f'<th class="{HEAD} text-left">Kills/h</th><th class="{HEAD} text-left">Set by</th>'
            f'<th class="{HEAD}"></th></tr>')
    rows = "".join(k3_row(s) for s in sources(data))
    table = (f'<div class="{TABLE}"><table class="w-full text-sm"><thead class="{THEAD}">{head}</thead>'
             f'<tbody class="divide-y divide-border">{rows}</tbody></table></div>')
    return wrap(page_head() + tabs(NEW_TABS + ["Kill rates"], "Kill rates") + filters + table)


def options(data: dict) -> list[dict]:
    return [
        {"id": "k1", "name": "K1 Rate in the table", "note": "Each source row carries its kill rate. A source with no rate shows No rate and a Set button. A Foundry rate shows a pencil.",
         "html": k1(data)},
        {"id": "k1-open", "name": "K1, Set open", "note": "Set opens a popover beside the cell, so the row keeps its size.",
         "html": k1(data, True)},
        {"id": "k2", "name": "K2 Rate in the source dialog", "note": "The table only reads. A source opens its dialog, which holds the kill rate above the drop table, grouped by the Wiki heading.",
         "html": k2(data)},
        {"id": "k3", "name": "K3 Kill rates tab", "note": "A tab of its own lists the sources with no OSRSClans rate, each with a rate field, who set it, Save and Remove.",
         "html": k3(data)},
        {"id": "today", "name": "Today", "note": "What ships today, on the Wiki scrape. It has no kill rates and no way to set one.",
         "html": today(data)},
    ]
