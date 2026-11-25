"""The public event page candidates: F1 standings table, F2 race lanes, F3 tier leaders."""

from html import escape

from charts import daily_points, points_over_time, team_legend
from mock import BOARDS, EVENT, TEAMS
from parts import TIER_NAMES, filterline, ic, n, team_img, team_link, tier_bar, tier_legend, tool

RANKED = sorted(TEAMS, key=lambda t: -t["total"])
DAILY = filterline("Daily", ["Points gained", "Rate comparison"], "Points gained")
MANAGE =f'<button type="button" class="ui-tool ui-signed-in-only">{ic("settings")}Manage</button>'


def place(i: int) -> str:
    return f'<span class="ui-place{f" ui-place--{i}" if i <= 3 else ""}">#{i}</span>'


def pending(team: dict) -> str:
    return f'<small class="fz-sub ui-pending">+{team["pending"]} pending</small>' if team["pending"] else ""


def event_head(tools: str) -> str:
    return (f'<section class="ui-panel ui-eventhead"><div><p class="ui-kicker">Active Event</p>'
            f'<h1 class="ui-h1 ui-h1--page">{EVENT["name"]}</h1><p class="ui-meta"><span>{EVENT["dates"]}</span></p>'
            f'</div><div class="ui-tools">{tools}</div></section>')


def boards(entries: list = BOARDS) -> str:
    cards = []
    for title, rows in entries:
        items = "".join(
            f'<li><span class="ui-pos{f" ui-place--{i}" if i <= 3 else ""}">{i}</span>'
            f'<span class="ui-name">{escape(rsn)}</span><span class="ui-val">{n(v)}</span></li>'
            for i, (rsn, v) in enumerate(rows, 1)
        )
        cards.append(f'<section class="ui-board"><div class="ui-board-head"><h3 class="ui-board-title">{title}</h3>'
                     f'</div><ol class="ui-board-rows ui-board-rows--3">{items}</ol></section>')
    return f'<div class="ui-boards">{"".join(cards)}</div>'


def section(title: str, body: str, aside: str = "") -> str:
    return f'<section><div class="fz-section-head"><h2 class="ui-h2">{title}</h2>{aside}</div>{body}</section>'


def chart_panel() -> str:
    tools = filterline("Range", ["All time", "30 days", "7 days", "24h"], "All time") + team_legend()
    return (f'<section class="ui-panel"><div class="fz-section-head"><h2 class="ui-h2">Points over time</h2></div>'
            f'<div class="fz-chart-tools">{tools}</div>{points_over_time()}'
            f'<div class="fz-chart-tools fz-gap-top">{DAILY}</div>{daily_points()}</section>')


def standings_row(i: int, team: dict) -> str:
    tiers = "".join(f'<td class="fz-num fz-hide-phone">{n(p)}</td>' for p in team["tiers"])
    return (f'<tr><td>{place(i)}</td><td>{team_link(team)}{tier_bar(team["tiers"])}</td>{tiers}'
            f'<td class="fz-num fz-hide-phone">{n(team["act"])}</td><td class="fz-num fz-hide-phone">{n(team["mile"])}</td>'
            f'<td class="fz-num"><b class="fz-strong">{n(team["total"])}</b>{pending(team)}</td></tr>')


def f1() -> str:
    heads = "".join(f'<th class="fz-num fz-hide-phone">{t}</th>' for t in TIER_NAMES + ["Activities", "Milestones"])
    rows = "".join(standings_row(i, t) for i, t in enumerate(RANKED, 1))
    table = (f'<div class="ui-scroll"><table class="ui-table ui-table--rows"><thead><tr><th>#</th><th>Team</th>{heads}'
             f'<th class="fz-num">Total</th></tr></thead><tbody>{rows}</tbody></table></div>')
    head = event_head(f'<span class="ui-status ui-status--closed">{EVENT["left"]}</span>{MANAGE}')
    return head + section("Standings", table, tier_legend()) + chart_panel() + section("Leaderboards", boards())


def lane(i: int, team: dict, leader: float) -> str:
    parts = team["tiers"] + [team["act"] + team["mile"]]
    widths = [p / leader * 100 for p in parts]
    segs = "".join(f'<i class="ui-tier-{k + 1}" style="width: {w:.1f}%"></i>' for k, w in enumerate(widths[:4]) if w)
    segs += f'<i class="ui-seg-bg--4" style="width: {widths[4]:.1f}%"></i>'
    gap = "Leader" if team["total"] == leader else f'-{n(leader - team["total"])}'
    return (f'<a class="fz-lane" href="#">{place(i)}{team_link(team)}<div class="fz-bar">{segs}</div>'
            f'<span class="fz-gap">{gap}</span><span class="fz-lane-total">{n(team["total"])}</span></a>')


def f2() -> str:
    leader = RANKED[0]["total"]
    clock = (f'<div class="fz-clock"><span class="ui-bignum">{EVENT["days_left"]}</span>'
             f'<span class="ui-muted">days left</span></div>')
    head = (f'<section class="ui-panel ui-eventhead"><div><p class="ui-kicker">Active Event</p>'
            f'<h1 class="ui-h1 ui-h1--page">{EVENT["name"]}</h1><p class="ui-meta"><span>{EVENT["dates"]}</span></p>'
            f'<div class="ui-tools">{tool("Charts", "chart")}{MANAGE}</div></div>{clock}</section>')
    legend = tier_legend().replace("</div>", '<span><i class="fz-dot ui-seg-bg--4"></i>Activities and milestones</span></div>')
    lanes = f'<div class="fz-lanes">{"".join(lane(i, t, leader) for i, t in enumerate(RANKED, 1))}</div>'
    return head + section("The race", lanes, legend) + section("Leaderboards", boards())


def chip(i: int, team: dict) -> str:
    return (f'<a class="fz-chip" href="#">{place(i)}{team_img(team)}<span class="fz-chip-text">'
            f'<b>{escape(team["name"])}</b><span>{n(team["total"])}</span></span></a>')


def tier_board(k: int) -> str:
    ranked = sorted(TEAMS, key=lambda t: -t["tiers"][k])
    rows = "".join(
        f'<li><span class="ui-pos{f" ui-place--{i}" if i <= 3 else ""}">{i}</span>'
        f'<span class="ui-name">{escape(t["name"])}</span><span class="ui-val">{n(t["tiers"][k])}</span></li>'
        for i, t in enumerate(ranked, 1)
    )
    return (f'<section class="ui-board"><div class="ui-board-head"><h3 class="ui-board-title fz-tc{k + 1}">'
            f'{TIER_NAMES[k]}</h3></div><ol class="ui-board-rows ui-board-rows--3">{rows}</ol></section>')


def f3() -> str:
    head = event_head(f'<span class="ui-status ui-status--closed">{EVENT["left"]}</span>{MANAGE}')
    strip = f'<div class="fz-strip">{"".join(chip(i, t) for i, t in enumerate(RANKED, 1))}</div>'
    leaders = f'<div class="fz-leaders">{"".join(tier_board(k) for k in range(4))}</div>'
    lower = f'<div class="fz-two">{chart_panel()}<div class="fz-stack"><h2 class="ui-h2">Leaderboards</h2>{boards()}</div></div>'
    return head + strip + section("Tier leaders", leaders) + lower


def charts_sheet() -> str:
    leader = RANKED[0]["total"]
    bars = "".join(
        f'<p><span>{escape(t["name"])}</span><i class="fz-bg-t{t["t"]}" '
        f'style="width: {t["total"] / leader * 100:.0f}%"></i><b>{n(t["total"])}</b></p>' for t in RANKED
    )
    tools = filterline("Range", ["All time", "30 days", "7 days", "24h"], "7 days") + team_legend(hidden=("Iron Will",))
    body = (f'<div class="ui-dialog-head"><h2 class="ui-h3">{EVENT["name"]} - Analytics</h2>'
            f'<button type="button" class="ui-icon-btn" aria-label="Close">{ic("x")}</button></div>{tools}'
            f'<h3 class="ui-h3">Current standings</h3><div class="ui-hbars">{bars}</div>'
            f'<h3 class="ui-h3">Points over time</h3>{points_over_time(RANKED[:4])}'
            f'<div class="fz-chart-tools">{DAILY}</div>{daily_points(RANKED[:4])}')
    return f'<div class="ui-overlay ui-overlay--sheet"><aside class="ui-sheet">{body}</aside></div>'
