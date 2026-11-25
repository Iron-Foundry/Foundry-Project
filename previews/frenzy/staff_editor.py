"""The staff template editor candidates: F1 one item table, F2 a three-pane workspace, F3 event-first cards."""

from html import escape

from mock import BUDGET, EVENT
from parts import filterline, ic, tabs, tool
from staff_parts import (
    TEMPLATE_NAME, budget, cell_input, field, item_editor, lock_button, pick_field, rate_pick, remove_button,
    staff_head,
)

TEMPLATE_TABS = ["Items", "Activities", "Milestones", "Multipliers"]
SAVE = '<button type="button" class="ui-btn ui-btn--small">Save</button>'


def unrated(tiers: list[dict]) -> int:
    return sum(1 for t in tiers for items in t["sources"].values() for i in items if i["hours"] is None)


def grid_row(item: dict, source: str) -> str:
    hours = f'{item["hours"]:,.1f}' if item["hours"] is not None else '<span class="fz-warn">-</span>'
    kph = f'{item["kph"]:g}' if item["kph"] is not None else ""
    return (f'<tr><td>{escape(source)}</td><td><span class="fz-item"><img src="art/{item["item_id"]}.webp" '
            f'alt="{escape(item["name"])}"><span>{escape(item["name"])}</span></span></td><td>{rate_pick(item)}</td>'
            f'<td>{cell_input(str(item["denom"] or ""))}</td><td>{cell_input(kph)}</td><td class="fz-num">{hours}</td>'
            f'<td>{cell_input(str(item["required"]))}</td><td>{cell_input(str(item["dup"]))}</td>'
            f'<td>{cell_input(str(item["points"]))}</td><td><span class="fz-rowtools">{lock_button(item)}'
            f'{remove_button("item")}</span></td></tr>')


def f1(tiers: list[dict]) -> str:
    head = (f'<section class="ui-panel ui-form"><div class="ui-form-row">{field("Name", TEMPLATE_NAME)}'
            f'{field("Point cap", str(EVENT["cap"]))}</div>{field("Description", "Fourteen days and four tiers.")}'
            f'{budget()}<div class="ui-tools"><span class="ui-status">v{EVENT["version"]}</span>{tool("History", "history")}'
            f'{tool("Recalculate", "zap")}{tool("Cancel")}{SAVE}</div></section>')
    rows = []
    for tier in tiers:
        rows.append(f'<tr class="fz-group"><td colspan="10">{tier["name"]} · budget {BUDGET[tier["name"]]}%</td></tr>')
        rows += [grid_row(i, s) for s, items in tier["sources"].items() for i in items]
    cols = ["Source", "Item", "Rate source", "Drop denom", "KPH", "H/drop", "Req", "Dup", "Points", ""]
    table = (f'<div class="ui-scroll"><table class="ui-table fz-grid-table"><thead><tr>'
             f'{"".join(f"<th>{c}</th>" for c in cols)}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>')
    bar = (f'<div class="ui-toolbar ui-toolbar--split">{filterline("Tier", ["All", "Easy", "Medium", "Hard", "Elite"], "All")}'
           f'<div class="ui-tools">{tool("Add tier", "plus")}{tool("Add source", "plus")}{tool("Add item", "plus")}</div></div>')
    warn = (f'<p class="ui-banner">{ic("alert")}{unrated(tiers)} item has no kill rate on OSRSClans. '
            f'It keeps its hand-set points and shows as unbalanced.</p>')
    return staff_head("Templates") + head + tabs(TEMPLATE_TABS, "Items") + bar + warn + table


def tree(tiers: list[dict], active: tuple[str, str]) -> str:
    parts = []
    for tier in tiers:
        parts.append(f'<p>{tier["name"]}<small class="ui-muted">{BUDGET[tier["name"]]}%</small></p>')
        parts += [f'<a href="#" class="{"is-active" if (tier["name"], s) == active else ""}">{escape(s)}'
                  f'<small>{len(items)}</small></a>' for s, items in tier["sources"].items()]
    return f'<nav class="fz-tree" aria-label="Tiers and cards">{"".join(parts)}{tool("Add tier", "plus")}</nav>'


CARDS = {"Zulrah": ("NPC: Zulrah", "Kill Zulrah for its three uniques."),
         "Slayer": ("Sprite: Slayer skill icon", "Slayer task uniques from any monster.")}


def card_fields(card: str) -> str:
    image, hover = CARDS[card]
    name = f'<label class="ui-field">Card name<input class="ui-input" value="{escape(card)}"></label>'
    return f'<div class="ui-form-row">{name}{pick_field("Card image", image)}</div>{field("Hover text", hover)}'


def f2(tiers: list[dict], card: str = "Zulrah", tier_index: int = 0) -> str:
    tier = tiers[tier_index]
    items = tier["sources"][card]
    where = f'{tier["name"]} / {card}'
    mobile = f'<div class="fz-tree-mobile ui-toolbar">{pick_field("Card", where)}</div>'
    center = (f'<section class="ui-panel fz-stack">{card_fields(card)}{"".join(item_editor(i) for i in items)}'
              f'<div class="ui-tools">{tool("Add item", "plus")}{tool("Add card", "plus")}'
              f'{tool("Remove card", "trash", "ui-tool ui-tool--danger")}</div></section>')
    summary = (f'<aside class="ui-panel fz-facts"><p><b>{TEMPLATE_NAME}</b><span class="ui-status">v{EVENT["version"]}</span></p>'
               f'{field("Point cap", str(EVENT["cap"]))}{budget()}<p class="fz-warn">{ic("alert")}'
               f'{unrated(tiers)} item has no kill rate</p><div class="ui-tools">{tool("History", "history")}'
               f'{tool("Recalculate", "zap")}{tool("Cancel")}{SAVE}</div></aside>')
    return (staff_head("Templates") + tabs(TEMPLATE_TABS, "Items") + mobile
            + f'<div class="fz-work">{tree(tiers, (tier["name"], card))}{center}{summary}</div>')


def steps() -> str:
    names = [("Template", "is-done"), ("Teams", "is-done"), ("Schedule", "is-done"), ("Live", "is-active"), ("Closed", "")]
    items = "".join(f'<li class="{c}"><b>{i}</b>{s}</li>' for i, (s, c) in enumerate(names, 1))
    return f'<ol class="fz-steps">{items}</ol>'


def event_bar(active: str) -> str:
    picker = (f'<div class="ui-tools">{pick_field("Event", EVENT["name"] + " (active)")}'
              f'{tool("New event", "plus")}{tool("Deactivate")}</div>')
    head = (f'<section class="fz-staffhead"><div><p class="ui-kicker">Staff</p><h1 class="ui-h1 ui-h1--page">'
            f'PVM Frenzy</h1></div>{picker}</section>')
    names = ["Overview", "Template", "Teams", "Review queue 3"]
    return head + f'<section class="ui-panel">{steps()}</section>' + tabs(names, active)


def tier_cards(tier: dict) -> str:
    cards = "".join(
        f'<article class="fz-source"><header class="fz-source-head"><b>{escape(s)}</b>'
        f'<span class="fz-rowtools">{tool("Hover text", "message")}{remove_button("source")}</span></header>'
        f'{"".join(item_editor(i, "From ") for i in items)}{tool("Add item", "plus")}</article>'
        for s, items in tier["sources"].items()
    )
    return (f'<section><div class="fz-section-head"><h2 class="ui-h2">{tier["name"]}</h2><div class="ui-tools">'
            f'{field("Budget %", str(BUDGET[tier["name"]]))}{tool("Add source", "plus")}</div></div>'
            f'<div class="fz-sources">{cards}</div></section>')


def f3(tiers: list[dict]) -> str:
    bar = (f'<div class="ui-toolbar ui-toolbar--split"><span class="ui-muted">{TEMPLATE_NAME} · v{EVENT["version"]} · '
           f'cap {EVENT["cap"]:,} pts</span><div class="ui-tools">{tool("History", "history")}{tool("Recalculate", "zap")}{SAVE}</div></div>')
    note = (f'<p class="ui-banner">{ic("alert")}The event is live. A save makes version {EVENT["version"] + 1} '
            f'of the template.</p>')
    return (event_bar("Template") + note + bar + budget() + tabs(TEMPLATE_TABS, "Items")
            + tier_cards(tiers[0]) + tier_cards(tiers[3]))
