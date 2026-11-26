"""Write the frenzy draft bench pages into src/pages from draft_mock and draft_parts.

Run: python previews/site-theme/draft_pages.py, then render.py.
"""

from pathlib import Path

from draft_mock import CAPTAINS, TEAM_SIZE, assignments, cc, pool_after, signups, snake_captain
from draft_combo import d4_done, d4_live, d5_live
from draft_parts import board, intro, pool, turn_head

PAGES = Path(__file__).resolve().parent / "src" / "pages"
TOP = 5
TOP_TOTAL = TOP * len(CAPTAINS)
ALL = TEAM_SIZE * len(CAPTAINS)
PICKS = ALL - len(CAPTAINS)


def write(name: str, html: str) -> None:
    (PAGES / f"{name}.html").write_text(html, encoding="utf-8")


def top_live(next_pick: int) -> str:
    """Top Picks while a pick is due; the viewer is Hammer Time, on turn at pick 10."""
    head = turn_head(f"{CAPTAINS[snake_captain(next_pick)]} is picking", f"Top pick {next_pick} of {TOP_TOTAL} · Round {(next_pick - 1) // 4 + 1} of {TOP} · the rest are handed out after round {TOP}", next_pick, "then the next round reverses")
    return intro("Top Picks") + head + board(assignments(next_pick - 1), next_pick) + pool(pool_after(next_pick - 1), "Pick", ALL)


def d2_feed(made: int) -> str:
    teams = assignments(made + 4)
    flat = sorted((p, i, n) for i, picks in teams.items() for p, n, _ in picks)
    rows = []
    for pick, i, name in flat:
        if pick <= made:
            rows.append(f'<li><span>{pick}</span><p>{CAPTAINS[i]} took <b>{name}</b></p></li>')
        elif pick == made + 1:
            rows.append(f'<li class="is-now"><span>{pick}</span><p>{CAPTAINS[i]} is picking</p></li>')
        else:
            rows.append(f'<li class="is-later"><span>{pick}</span><p>{CAPTAINS[i]}</p></li>')
    feed = f'<section class="ui-panel"><h2 class="ui-h3">Top picks <small>{made} of {TOP_TOTAL}</small></h2><ol class="ui-draft-feed ui-draft-scroll">{"".join(rows)}</ol></section>'
    team_rows = "".join(f'<li><span class="ui-name"><b>{CAPTAINS[i]}</b></span><small>{len(p) + 1} / {TEAM_SIZE}</small></li>' for i, p in assignments(made).items())
    teams_panel = f'<section class="ui-panel"><h2 class="ui-h3">Teams</h2><ul class="ui-rows">{team_rows}</ul><p class="ui-hint">The other {PICKS - TOP_TOTAL} signups are handed out in snake order after round {TOP}.</p></section>'
    middle = turn_head(f"{CAPTAINS[snake_captain(made + 1)]} is picking", f"Top pick {made + 1} of {TOP_TOTAL}", None, "") + pool(pool_after(made), "Pick", ALL)
    return intro("Top Picks") + f'    <div class="ui-draft-cols">{feed}<div class="ui-draft-pool">\n{middle}</div>{teams_panel}</div>\n'


def d3_grid(made: int) -> str:
    teams = assignments(made)
    head = "".join(f"<th><b>{c}</b>{i + 1}</th>" for i, c in enumerate(CAPTAINS))
    body = []
    for rnd in range(1, TOP + 1):
        cells = []
        for i in range(len(CAPTAINS)):
            pos = i if rnd % 2 else len(CAPTAINS) - 1 - i
            pick = (rnd - 1) * len(CAPTAINS) + pos + 1
            done = next((n for p, n, _ in teams[i] if p == pick), None)
            cls = "" if done else ' class="is-now"' if pick == made + 1 else ' class="is-empty"'
            cells.append(f"<td{cls}>{done or (f'{pick} · picking' if pick == made + 1 else pick)}</td>")
        arrow = "arrow-right" if rnd % 2 else "chevron-left"
        body.append(f"<tr><th>Round {rnd} {{{{icon:{arrow}}}}}</th>{''.join(cells)}</tr>")
    body.append(f'<tr><th>Rounds {TOP + 1} to {PICKS // 4}</th><td colspan="4" class="is-empty">Handed out in snake order after round {TOP}: {PICKS - TOP_TOTAL} signups</td></tr>')
    grid = f'<table class="ui-draft-grid"><thead><tr><th></th>{head}</tr></thead><tbody>{"".join(body)}</tbody></table>'
    aside = f'<p class="ui-draft-meta"><span class="ui-draft-live">Live</span><span>Top pick {made + 1} of {TOP_TOTAL} · Hammer Time is picking</span></p>'
    return intro("Top Picks", aside) + f'    <div class="ui-draft-split">{grid}\n{pool(pool_after(made), "Pick", ALL)}</div>\n'


def done() -> str:
    teams = assignments(PICKS)
    kinds = {p: ("auto" if p > TOP_TOTAL else "drafted") for p in range(1, PICKS + 1)}
    head = turn_head("The draft is complete", f"{TOP_TOTAL} top picks · {PICKS - TOP_TOTAL} handed out · 4 teams of {TEAM_SIZE}", None, "", '<a class="ui-btn ui-btn--small" href="#">{{icon:arrow-right}}Go to the event</a>')
    return intro("Top Picks", '<button type="button" class="ui-tool">{{icon:pencil}}Move members</button>') + head + board(teams, None, kinds)


def full_live(next_pick: int) -> str:
    who = CAPTAINS[snake_captain(next_pick)]
    head = turn_head(f"{who} is picking", f"Pick {next_pick} of {PICKS} · Round {(next_pick - 1) // 4 + 1} of {PICKS // 4}", next_pick, "then the next round reverses")
    return intro("Full draft") + head + board(assignments(next_pick - 1), next_pick) + pool(pool_after(next_pick - 1), f"Pick for {who}", ALL)


def roster() -> str:
    picks = [(p, n, pts) for p, n, pts in assignments(PICKS)[1]]
    rows = "".join(f'<li><span class="ui-name">{n}</span>{cc(pts)}<span class="ui-val">{"top pick" if p <= TOP_TOTAL else "auto"}</span><button type="button" class="ui-select ui-select--small">Move to…{{{{icon:chevron-down}}}}</button></li>' for p, n, pts in picks)
    dialog = f'<div class="ui-overlay"><div class="ui-dialog" role="dialog" aria-label="Hammer Time roster"><header class="ui-dialog-head"><h2 class="ui-h3">Hammer Time <small>{len(picks) + 1} / {TEAM_SIZE}</small></h2><button type="button" class="ui-icon-btn" aria-label="Close">{{{{icon:x}}}}</button></header><label class="ui-search">{{{{icon:search}}}}<input type="search" placeholder="Search RSN..." aria-label="Search RSN"></label><ol class="ui-draft-rows ui-draft-scroll"><li class="ui-draft-colhead"><span>RSN</span><span>CC Rank</span><span class="ui-val">How</span><span></span></li>{rows}</ol></div></div>'
    return intro("Top Picks", "") + dialog


def staff() -> str:
    captains = "".join(f'<li class="is-on">{{{{icon:check-square}}}}<span class="ui-name">{c}</span><small>Willing to captain</small>{cc(20000 - i * 3000)}</li>' for i, c in enumerate(CAPTAINS))
    others = "".join(f'<li>{{{{icon:square}}}}<span class="ui-name">{n}</span><small>{"Willing to captain" if i % 5 == 0 else ""}</small>{cc(p)}</li>' for i, (n, p) in enumerate(signups()[:6]))
    mode = '<div class="ui-form-row"><div class="ui-field"><span>Mode</span><span class="ui-variant-switch"><button type="button">Full draft</button><button type="button" class="is-active">Top Picks</button></span></div><label class="ui-field"><span>Top picks per captain</span><input class="ui-input" type="number" value="5"></label></div>'
    return (
        '    <section class="ui-intro ui-intro--actions"><div><p class="ui-kicker">Control Panel · PVM Frenzy</p><h1 class="ui-h1 ui-h1--page">Winter Frenzy</h1></div>'
        '<div class="ui-tools"><button type="button" class="ui-tool">{{icon:unlock}}Open signups</button><button type="button" class="ui-btn ui-btn--small">{{icon:dices}}Draw the order</button></div></section>\n'
        f'    <section class="ui-panel ui-form"><h2 class="ui-h3">Draft setup</h2>{mode}<p class="ui-hint">{ALL} signups · 4 captains · teams of {TEAM_SIZE}. Captains pick 5 each in snake order, then the site hands out the other {PICKS - TOP_TOTAL} in the same order.</p></section>\n'
        f'    <section class="ui-draft-pool"><div class="ui-draft-pool-head"><h2 class="ui-h3">Choose captains <small>4 chosen</small></h2><label class="ui-search">{{{{icon:search}}}}<input type="search" placeholder="Search signups..." aria-label="Search signups"></label></div>'
        f'<ul class="ui-draft-pickers ui-draft-scroll">{captains}{others}</ul></section>\n'
    )


def order() -> str:
    head = turn_head("The order is drawn", f"4 captains · Top Picks, 5 each · {PICKS - TOP_TOTAL} handed out after", 1, "then round 2 runs 4 to 1")
    return intro("Top Picks", '<button type="button" class="ui-btn ui-btn--small">{{icon:zap}}Start the draft</button>') + head + board(assignments(0), 1) + pool(pool_after(0), None, ALL)


if __name__ == "__main__":
    write("d4-live", d4_live(9))
    write("d5-live", d5_live(9))
    write("d4-done", d4_done())
    write("d1-live", top_live(10))
    write("d1-order", order())
    write("d1-done", done())
    write("d1-full", full_live(87))
    write("d2-live", d2_feed(9))
    write("d3-live", d3_grid(9))
    write("d-staff", staff())
    write("d-roster", roster())
    print("wrote 11 draft pages")
