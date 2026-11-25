"""The public team page candidates: F1 item table, F2 tier cards and item tiles, F3 one page with a rail."""

from html import escape

from charts import points_over_time
from npc_card import npc_card
from mock import ACTIVITIES, MILESTONES, MULTIPLIERS, TEAMS
from parts import filterline, item_img, n, pips, rate_text, select, tabs
from team_parts import (
    TEAM, activities, contribution, earned, is_unlocked, milestones, multipliers, source_card, source_factor,
    team_head, tier_count, tier_items,
)

UNLOCKED = sum(1 for m in MULTIPLIERS if is_unlocked(m))


def tier_points(tier: dict) -> float:
    return sum(earned(i) * source_factor(s) for s, items in tier["sources"].items() for i in items)


def score_tiles(tiers: list[dict]) -> str:
    cells = [(f"{t['name']} Tier", tier_points(t)) for t in tiers] + [("Activities", TEAM["act"]), ("Milestones", TEAM["mile"])]
    tiles = "".join(f'<div class="ui-tile"><span class="ui-stat-label">{k}</span><b class="ui-stat-value">{n(v)}</b></div>'
                    for k, v in cells)
    return f'<div class="ui-tiles ui-tiles--six">{tiles}</div>'


def item_row(item: dict, source: str) -> str:
    state = "fz-done" if item["have"] >= item["required"] else ""
    points = f'<b class="fz-done">+{earned(item)}</b>' if earned(item) else f'<span class="ui-muted">{item["points"]}</span>'
    rate_cls = "fz-warn" if item["hours"] is None else "ui-muted"
    return (f'<tr><td><span class="fz-item {state}">{item_img(item)}<span>{escape(item["name"])}</span></span></td>'
            f'<td class="fz-hide-phone">{escape(source)}</td><td class="fz-hide-phone {rate_cls}">{rate_text(item)}</td>'
            f'<td>{pips(item["have"], item["required"] + item["dup"])}</td><td class="fz-num">{points}</td></tr>')


def f1(tiers: list[dict]) -> str:
    rows = []
    for tier in tiers:
        rows.append(f'<tr class="fz-group"><td colspan="5">{tier["name"]} · {tier_count(tier)} · '
                    f'{n(tier_points(tier))} pts</td></tr>')
        rows += [item_row(i, s) for s, items in tier["sources"].items() for i in items]
    table = (f'<div class="ui-scroll"><table class="ui-table"><thead><tr><th>Item</th><th class="fz-hide-phone">Source</th>'
             f'<th class="fz-hide-phone">Rate</th><th>Have</th><th class="fz-num">Points</th></tr></thead>'
             f'<tbody>{"".join(rows)}</tbody></table></div>')
    names = ["Items", "Activities", "Milestones", f"Multipliers {UNLOCKED}", "Charts"]
    tiers_line = filterline("Tier", ["All"] + [f'{t["name"]} {tier_count(t)}' for t in tiers], "All")
    return team_head(False) + score_tiles(tiers) + tabs(names, "Items") + tiers_line + table


def tier_card(tier: dict, active: bool, k: int) -> str:
    items = tier_items(tier)
    done = sum(1 for i in items if i["have"])
    return (f'<button type="button" class="fz-tier{" is-active" if active else ""}"><span class="fz-tier-head">'
            f'<b class="fz-tc{k + 1}">{tier["name"]}</b><span class="ui-muted">{done}/{len(items)} items</span></span>'
            f'<span class="fz-tier-pts">{n(tier_points(tier))}</span><span class="ui-progress"><span '
            f'style="width: {done / len(items) * 100:.0f}%"></span></span></button>')


def f2(tiers: list[dict], active: int = 0) -> str:
    cards = f'<div class="fz-tiers">{"".join(tier_card(t, i == active, i) for i, t in enumerate(tiers))}</div>'
    names = ["Items", f'Activities {n(TEAM["act"])} pts', f'Milestones {n(TEAM["mile"])} pts', f"Multipliers {UNLOCKED}"]
    sources ="".join(source_card(s, items, True) for s, items in tiers[active]["sources"].items())
    key = '<div class="fz-legend"><span>Bright: obtained</span><span>Dim: still to get</span></div>'
    return team_head(True) + cards + tabs(names, "Items") + key + f'<div class="fz-sources">{sources}</div>'


def rail_link(label: str, count: str, active: bool = False) -> str:
    return f'<a href="#" class="{"is-active" if active else ""}">{label}<small>{count}</small></a>'


def rail(tiers: list[dict]) -> tuple[str, str]:
    links = "".join(rail_link(t["name"], tier_count(t), i == 0) for i, t in enumerate(tiers))
    goals = (rail_link("Activities", str(len(ACTIVITIES))) + rail_link("Milestones", str(len(MILESTONES)))
             + rail_link("Multipliers", f"{UNLOCKED}/{len(MULTIPLIERS)}") + rail_link("Charts", ""))
    side = f'<nav class="fz-rail" aria-label="Team sections"><p class="ui-kicker">Items</p>{links}<p class="ui-kicker">Goals</p>{goals}</nav>'
    mobile_names = [t["name"] for t in tiers] + ["Activities", "Milestones", "Multipliers", "Charts"]
    mobile = tabs(mobile_names, "Easy").replace('class="ui-tabs"', 'class="ui-tabs fz-rail-mobile"')
    return side, mobile


def tier_section(tier: dict, art: dict | None, open_card: tuple[str, str] | None) -> str:
    cards = "".join(npc_card(s, items, art, (tier["name"], s) == open_card) if art is not None
                    else source_card(s, items, False)
                    for s, items in tier["sources"].items())
    return (f'<section><div class="fz-section-head"><h2 class="ui-h2">{tier["name"]}</h2><span class="ui-muted">'
            f'{tier_count(tier)} items · {n(tier_points(tier))} pts</span></div><div class="fz-sources">{cards}</div></section>')


def f3(tiers: list[dict], art: dict | None = None, open_card: tuple[str, str] | None = None) -> str:
    side, mobile = rail(tiers)
    body = "".join(tier_section(t, art, open_card) for t in tiers)
    body += f'<section><h2 class="ui-h2">Activities</h2>{activities()}</section>'
    body += f'<section><h2 class="ui-h2">Milestones</h2>{milestones()}</section>'
    body += f'<section><h2 class="ui-h2">Multipliers</h2>{multipliers()}</section>'
    kinds = filterline("Type", ["All", "Items", "Activities", "Milestones"], "All")
    body += (f'<section class="ui-panel"><h2 class="ui-h2">Charts</h2><div class="fz-chart-tools">{kinds}'
             f'{select("Player: All")}</div>{points_over_time(TEAMS[:1])}<h3 class="ui-h3 fz-gap-top">Player contribution</h3>{contribution()}</section>')
    return team_head(False) + mobile + f'<div class="fz-side">{side}<div class="fz-stack">{body}</div></div>'
