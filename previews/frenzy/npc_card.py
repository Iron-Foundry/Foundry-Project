"""The refined F3 source card: the NPC still, item and title state colours, and the rate figures behind (i)."""

from html import escape

from parts import ic, item_img, n, pips
from team_parts import earned, source_factor

MEASURED_BY = {"wom": "WOM EHB", "droptracker": "DropTracker", "clue_scroll": "Clue scroll",
               "item_drop": "Item drop", "superior": "Superior", "fixed": "Fixed"}


def item_state(item: dict) -> str:
    if item["have"] >= item["required"] + item["dup"]:
        return "is-done"
    return "is-part" if item["have"] >= item["required"] else ""


def title_state(items: list[dict]) -> str:
    states = [item_state(i) for i in items]
    if all(s == "is-done" for s in states):
        return "fz-done"
    return "fz-part" if all(states) else ""


def is_group(card: str, items: list[dict]) -> bool:
    return any(i["source"] != card for i in items)


def mosaic(card: str, items: list[dict]) -> str:
    images = "".join(item_img(i) for i in items[:4])
    return f'<span class="fz-npc fz-mosaic" role="img" aria-label="{escape(card)}: {len(items)} items">{images}</span>'


def card_art(card: str, items: list[dict], art: dict[str, str | None]) -> str:
    still = art.get(card) if is_group(card, items) else art.get(card.split(", ")[0])
    if still:
        sprite = " fz-sprite" if still.startswith("sprite-") else ""
        return f'<img class="fz-npc{sprite}" src="art/{still}" alt="{escape(card)}">'
    if is_group(card, items):
        return mosaic(card, items)
    return f'<span class="fz-npc fz-noicon" role="img" aria-label="{escape(card)} has no image"></span>'


def rate_rows(items: list[dict], with_source: bool) -> str:
    rows = []
    for item in items:
        hours = f'{item["hours"]:,.1f} h' if item["hours"] is not None else "-"
        denom = f'1/{item["denom"]:,}' if item["denom"] else "-"
        source = (f'<span class="fz-sub">{escape(item["source"])} · {item["kph"]:g}/h</span>' if with_source and item["kph"]
                  else f'<span class="fz-sub">{escape(item["source"])} · no kill rate</span>' if with_source else "")
        rows.append(f'<tr><td>{escape(item["name"])}{source}</td><td class="fz-num">{denom}</td>'
                    f'<td class="fz-num">{hours}</td></tr>')
    return "".join(rows)


def info_panel(card: str, items: list[dict]) -> str:
    first = items[0]
    if is_group(card, items):
        head = ""
    elif first["kph"] is None:
        head = '<p class="fz-warn">OSRSClans has no kill rate for this source.</p>'
    else:
        unit = "Raids per hour" if first["raid"] else "Kills per hour"
        points = " · 65,000 points" if first["raid"] and "Ancient" in first["source"] else ""
        head = (f'<p class="fz-facts-row"><span>{unit}</span><b>{first["kph"]:g}</b></p><p class="fz-facts-row">'
                f'<span>Measured by</span><b>{MEASURED_BY.get(first["measurer"] or "", "-")}{points}</b></p>')
    table = (f'<table class="ui-table fz-rate-table"><thead><tr><th>Item</th><th class="fz-num">Chance</th>'
             f'<th class="fz-num">A drop</th></tr></thead><tbody>{rate_rows(items, is_group(card, items))}</tbody></table>')
    return f'<div class="fz-popover" role="dialog" aria-label="Rates">{head}{table}</div>'


def item_li(item: dict) -> str:
    points = earned(item)
    value = f"+{points}" if points else f'+{item["points"]}'
    return (f'<li class="{item_state(item)}">{item_img(item)}<span>{escape(item["name"])}</span>'
            f'{pips(item["have"], item["required"] + item["dup"])}<b class="{"" if points else "ui-muted"}">{value}</b></li>')


def npc_card(source: str, items: list[dict], art: dict[str, str | None], is_open: bool = False) -> str:
    done = sum(1 for i in items if i["have"] >= i["required"])
    factor = source_factor(source)
    mult = f'<span class="ui-mult">{factor:g}x</span>' if factor > 1 else ""
    pts = sum(earned(i) for i in items) * factor
    info = (f'<button type="button" class="fz-info" aria-pressed="{"true" if is_open else "false"}" '
            f'title="Rates">{ic("info")}</button>{info_panel(source, items) if is_open else ""}')
    return (f'<article class="fz-source fz-source--npc">{card_art(source, items, art)}<div class="fz-source-main">'
            f'<header class="fz-source-title"><b class="{title_state(items)}">{escape(source)}</b><span class="ui-meta">'
            f'<span>{done}/{len(items)}</span>{mult}<span>{n(pts)} pts</span></span></header>'
            f'<div class="fz-info-row">{info}</div></div>'
            f'<div class="ui-progress"><span style="width: {done / len(items) * 100:.0f}%"></span></div>'
            f'<ul class="ui-items">{"".join(item_li(i) for i in items)}</ul></article>')
