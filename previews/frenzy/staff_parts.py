"""The pieces of the staff frenzy page that the three candidates share."""

from html import escape

from mock import BUDGET, EVENT
from parts import TIER_NAMES, ic, n, rate_text, tabs

TEMPLATE_NAME = "Winter frenzy"


def staff_head(active: str, extra: str = "") -> str:
    return (f'<section class="fz-staffhead"><div><p class="ui-kicker">Staff</p><h1 class="ui-h1 ui-h1--page">'
            f'PVM Frenzy</h1></div>{extra}</section>{tabs(["Templates", "Events", "Submissions"], active)}')


def field(label: str, value: str, cls: str = "") -> str:
    return (f'<label class="ui-field {cls}">{label}<input class="ui-input" value="{escape(value)}"></label>')


def pick_field(label: str, value: str) -> str:
    return f'<label class="ui-field">{label}<button type="button" class="ui-select ui-input">{escape(value)}{ic("chevron-down")}</button></label>'


def cell_input(value: str, text: bool = False) -> str:
    return f'<input class="fz-in{" fz-in--text" if text else ""}" value="{escape(value)}">'


def rate_pick(item: dict) -> str:
    if item["hours"] is None:
        return f'<button type="button" class="fz-pick is-unrated"><span>No kill rate</span>{ic("chevron-down")}</button>'
    label = f'{item["source"]} · {item["hours"]:,.1f} h'
    return f'<button type="button" class="fz-pick"><span>{escape(label)}</span>{ic("chevron-down")}</button>'


def lock_button(item: dict) -> str:
    title = "Unlock points (allow recalculation)" if item["locked"] else "Lock points (exclude from recalculation)"
    cls = "ui-icon-btn fz-locked" if item["locked"] else "ui-icon-btn"
    return f'<button type="button" class="{cls}" title="{title}">{ic("lock" if item["locked"] else "unlock")}</button>'


def remove_button(what: str) -> str:
    return f'<button type="button" class="ui-icon-btn" title="Remove {what}">{ic("trash")}</button>'


def budget() -> str:
    cap = EVENT["cap"]
    segs = "".join(f'<i class="ui-tier-{i + 1}" style="width: {BUDGET[t]}%"></i>' for i, t in enumerate(TIER_NAMES))
    labels = "".join(f'<span><i class="fz-dot ui-tier-{i + 1}"></i>{t} {BUDGET[t]}% · {n(cap * BUDGET[t] / 100)} pts</span>'
                     for i, t in enumerate(TIER_NAMES))
    return (f'<div class="fz-budget"><div class="fz-bar">{segs}</div><div class="fz-budget-labels">{labels}'
            f'<span class="fz-done">Budgets sum to 100%</span></div></div>')


def rate_line(item: dict, prefix: str = "") -> str:
    cls = "fz-rate fz-warn" if item["hours"] is None else "fz-rate"
    note = " Unbalanced until KPH is set." if item["hours"] is None else ""
    raid = " at 65,000 points" if item["raid"] and "Ancient" in item["source"] else ""
    return (f'<p class="{cls}">{ic("alert") if note else ""}<span>{prefix}<b>{escape(item["source"])}</b>{raid} · '
            f'{rate_text(item)}.{note}</span><button type="button" class="ui-tool">Change</button></p>')


def item_editor(item: dict, prefix: str = "") -> str:
    fields = "".join(f'<label class="ui-field">{k}<input class="ui-input" value="{v}"></label>'
                     for k, v in (("Points", item["points"]), ("Required", item["required"]), ("Dup required", item["dup"])))
    if item["hours"] is None:
        fields += '<label class="ui-field">KPH<input class="ui-input" placeholder="e.g. 4"></label>'
    return (f'<div class="fz-irow"><div class="fz-irow-head"><span class="fz-item"><img src="art/{item["item_id"]}.webp" '
            f'alt="{escape(item["name"])}"><input class="ui-input" value="{escape(item["name"])}"></span>'
            f'<span class="fz-rowtools">{lock_button(item)}{remove_button("item")}</span></div>'
            f'{rate_line(item, prefix)}<div class="fz-irow-fields">{fields}</div></div>')
