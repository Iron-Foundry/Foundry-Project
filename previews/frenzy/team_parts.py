"""The pieces of the public team page that the three candidates share."""

from html import escape

from mock import ACTIVITIES, EVENT, MILESTONES, MULTIPLIERS, OBTAINED, PLAYERS, TEAMS
from parts import ic, item_img, n, pips, rate_text, team_img, tool, track

TEAM = TEAMS[0]


def earned(item: dict) -> int:
    base = item["points"] if item["have"] >= item["required"] else 0
    return base + (item["points"] // 2 if item["have"] > item["required"] else 0)


def tier_items(tier: dict) -> list[dict]:
    return [i for items in tier["sources"].values() for i in items]


def tier_count(tier: dict) -> str:
    items = tier_items(tier)
    return f'{sum(1 for i in items if i["have"]) }/{len(items)}'


def is_unlocked(mult: dict) -> bool:
    return all(OBTAINED.get(name) for name in mult["needs"])


def source_factor(source: str) -> float:
    return max([m["factor"] for m in MULTIPLIERS if source in m["affects"] and is_unlocked(m)] or [1])


def team_head(with_charts: bool) -> str:
    shown = "".join(f"<span>{p}</span>" for p in PLAYERS[:8])
    more = f'<button type="button" class="ui-more--inline">+{len(PLAYERS) - 8} more</button>'
    charts = tool("Charts", "chart") if with_charts else ""
    pending = f'<span class="ui-pending">+{TEAM["pending"]} pending</span>' if TEAM["pending"] else ""
    return (f'<a class="ui-tool ui-back" href="#">{ic("chevron-left")}{EVENT["name"]}</a>'
            f'<section class="ui-panel fz-teamhead">{team_img(TEAM)}<div><h1 class="ui-h1 ui-h1--page">'
            f'{TEAM["name"]}</h1><p class="ui-meta ui-participants">{shown}{more}</p></div>'
            f'<div class="ui-tools">{charts}<div class="ui-teamcard-pts"><b>{n(TEAM["total"])} pts</b>{pending}'
            f"<small>#1 of {len(TEAMS)}</small></div></div></section>")


def item_li(item: dict) -> str:
    state = "is-done" if item["have"] >= item["required"] else ""
    points = f'<b>+{earned(item)}</b>' if earned(item) else f'<b class="ui-muted">+{item["points"]}</b>'
    return (f'<li class="{state}">{item_img(item)}<span>{escape(item["name"])}<small>{rate_text(item)}</small></span>'
            f'{pips(item["have"], item["required"] + item["dup"])}{points}</li>')


def source_card(source: str, items: list[dict], tiles: bool) -> str:
    done = sum(1 for i in items if i["have"])
    factor = source_factor(source)
    mult = f'<span class="ui-mult">{factor:g}x</span>' if factor > 1 else ""
    pts = sum(earned(i) for i in items) * factor
    body = (f'<div class="fz-tiles">{"".join(item_tile(i) for i in items)}</div>' if tiles
            else f'<ul class="ui-items">{"".join(item_li(i) for i in items)}</ul>')
    return (f'<article class="fz-source"><header class="fz-source-head"><b>{escape(source)}</b>'
            f'<span class="ui-meta"><span>{done}/{len(items)}</span>{mult}<span>{n(pts)} pts</span></span></header>'
            f'<div class="ui-progress"><span style="width: {done / len(items) * 100:.0f}%"></span></div>{body}</article>')


def item_tile(item: dict) -> str:
    state = "is-done" if item["have"] >= item["required"] else "is-missing"
    mark = ic("check-square") if item["have"] else ""
    value = f'+{earned(item)}' if earned(item) else f'{item["points"]}'
    title = f'{item["name"]}: {rate_text(item)}'
    return (f'<div class="fz-itile {state}" title="{escape(title)}">{mark}{item_img(item)}'
            f'<span>{escape(item["name"])}</span><b>{value}</b></div>')


def goal(entry: dict) -> str:
    done = sum(1 for t in entry["tiers"] if entry["current"] >= t)
    points = entry["step"] * done * (entry["mult"] if done == 4 else 1)
    value = f'<b class="fz-done">+{n(points)}</b>' if points else f'<b class="ui-muted">{n(entry["step"] * 4 * entry["mult"])} max</b>'
    mult = f' <span class="ui-mult">x{entry["mult"]:g}</span>' if done == 4 and entry["mult"] > 1 else ""
    return (f'<article class="fz-goal"><div class="fz-goal-head"><b>{escape(entry["name"])}</b>{value}</div>'
            f'{track(entry["current"], entry["tiers"])}<span class="fz-sub">{n(entry["current"])} {entry["unit"]}{mult}</span></article>')


def activities() -> str:
    return f'<div class="fz-goals">{"".join(goal(a) for a in ACTIVITIES)}</div>'


def milestones() -> str:
    groups = "".join(
        f'<div class="fz-stack"><p class="ui-kicker">{cat}</p>{"".join(goal(m) for m in entries)}</div>'
        for cat, entries in MILESTONES.items()
    )
    return f'<div class="fz-goals">{groups}</div>'


def multipliers() -> str:
    cards = []
    for m in MULTIPLIERS:
        on = is_unlocked(m)
        needs = "".join(f'<li class="{"fz-done" if OBTAINED.get(r) else "ui-muted"}">'
                        f'{ic("check-square" if OBTAINED.get(r) else "square")}{escape(r)}</li>' for r in m["needs"])
        cards.append(f'<article class="fz-mult{" is-on" if on else ""}"><div class="fz-mult-head">'
                     f'{ic("unlock" if on else "lock")}<b>{m["name"]}</b><span class="ui-mult">x{m["factor"]:g}</span>'
                     f'</div><p class="ui-muted">{m["desc"]}</p><ul class="fz-reqs">{needs}</ul>'
                     f'<span class="fz-sub">Applies to {", ".join(m["affects"])}</span></article>')
    return f'<div class="fz-mults">{"".join(cards)}</div>'


def contribution() -> str:
    shares = [("Slag Heap", 620), ("Quench", 410), ("Mossy Ingot", 300), ("xTinyAnvil", 250), ("Hammer Time", 180)]
    bars = "".join(f'<p><span>{p}</span><i class="fz-bg-t1" style="width: {v / 620 * 100:.0f}%"></i><b>{v}</b></p>'
                   for p, v in shares)
    return f'<div class="ui-hbars">{bars}</div>'
