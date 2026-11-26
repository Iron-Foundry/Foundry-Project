"""Round 3 of the frenzy draft bench: the snake grid, recent picks and full teams on one page."""

from draft_mock import CAPTAINS, TEAM_SIZE, assignments, cc, pool_after, snake_captain
from draft_parts import intro, pool, turn_head

TOP = 5
N = len(CAPTAINS)
ALL = TEAM_SIZE * N
PICKS = ALL - N


def pick_of(rnd: int, col: int) -> int:
    pos = col if rnd % 2 else N - 1 - col
    return (rnd - 1) * N + pos + 1


def snake_grid(made: int) -> str:
    """The top-pick rounds as rows, one column per captain, the handed-out rounds folded."""
    teams = assignments(made)
    by_pick = {p: n for picks in teams.values() for p, n, _ in picks}
    head = "".join(f"<th><b>{c}</b>{i + 1}</th>" for i, c in enumerate(CAPTAINS))
    rows = []
    for rnd in range(1, TOP + 1):
        cells = []
        for col in range(N):
            pick = pick_of(rnd, col)
            if pick in by_pick:
                cells.append(f"<td>{by_pick[pick]}</td>")
            elif pick == made + 1:
                cells.append(f'<td class="is-now">{pick} · picking</td>')
            else:
                cells.append(f'<td class="is-empty">{pick}</td>')
        arrow = "arrow-right" if rnd % 2 else "chevron-left"
        rows.append(f"<tr><th>Round {rnd} {{{{icon:{arrow}}}}}</th>{''.join(cells)}</tr>")
    rows.append(f'<tr><th>Rounds {TOP + 1} to {PICKS // N}</th><td colspan="{N}" class="is-empty">Handed out in snake order after round {TOP}</td></tr>')
    return f'<table class="ui-draft-grid"><thead><tr><th></th>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table>'


def recent_feed(made: int, limit: int = 8) -> str:
    """The latest picks, newest first, each with its captain and round."""
    teams = assignments(made)
    flat = sorted(((p, i, n) for i, picks in teams.items() for p, n, _ in picks), reverse=True)[:limit]
    rows = "".join(
        f'<li><span>{p}</span><p>{CAPTAINS[i]} took <b>{n}</b><small>Round {(p - 1) // N + 1}</small></p></li>'
        for p, i, n in flat
    )
    return f'<section class="ui-panel"><h2 class="ui-h3">Recent picks</h2><ol class="ui-draft-feed">{rows}</ol></section>'


def full_teams(made: int, next_pick: int | None) -> str:
    """Every team with its whole roster: captain first, then each pick, top picks apart from handed-out ones."""
    teams = assignments(made)
    cols = []
    for i in range(N):
        now = next_pick is not None and snake_captain(next_pick) == i
        rows = [f'<li><span class="ui-draft-num">C</span><span class="ui-name"><b>{CAPTAINS[i]}</b></span><span class="ui-cc">Captain</span></li>']
        for p, n, pts in teams[i]:
            tag = ' <small class="ui-hint">auto</small>' if p > TOP * N else ""
            rows.append(f'<li><span class="ui-draft-num">{p}</span><span class="ui-name">{n}{tag}</span>{cc(pts)}</li>')
        if now:
            rows.append(f'<li class="is-empty is-next"><span class="ui-draft-num">{next_pick}</span><span class="ui-name">Picking now</span></li>')
        cols.append(
            f'<section class="ui-draft-team{" is-now" if now else ""}"><header><b>{CAPTAINS[i]}</b>'
            f'<span>{len(teams[i]) + 1} / {TEAM_SIZE}</span></header><ol class="ui-draft-scroll ui-draft-scroll--team">{"".join(rows)}</ol></section>'
        )
    return f'<section class="ui-block"><h2 class="ui-h2">Teams</h2><div class="ui-draft-board">{"".join(cols)}</div></section>'


def head(made: int) -> str:
    nxt = made + 1
    return turn_head(
        f"{CAPTAINS[snake_captain(nxt)]} is picking",
        f"Top pick {nxt} of {TOP * N} · Round {(nxt - 1) // N + 1} of {TOP} · the rest are handed out after round {TOP}",
        None, "",
    )


def d4_live(made: int) -> str:
    """D4 Stacked: head, grid beside recent picks, the pool, then the full teams."""
    return (
        intro("Top Picks") + head(made)
        + f'    <div class="ui-draft-split">{snake_grid(made)}{recent_feed(made)}</div>\n'
        + pool(pool_after(made), "Pick", ALL)
        + f"    {full_teams(made, made + 1)}\n"
    )


def d5_live(made: int) -> str:
    """D5 Grid first: head and grid across the page, then the pool beside recent picks, then the full teams."""
    return (
        intro("Top Picks") + head(made)
        + f"    {snake_grid(made)}\n"
        + f'    <div class="ui-draft-split ui-draft-split--pool">{pool(pool_after(made), "Pick", ALL)}{recent_feed(made, 10)}</div>\n'
        + f"    {full_teams(made, made + 1)}\n"
    )


def d4_done() -> str:
    """The finished draft: the grid of top picks and every full team."""
    return (
        intro("Top Picks", '<button type="button" class="ui-tool">{{icon:pencil}}Move members</button>')
        + turn_head("The draft is complete", f"{TOP * N} top picks · {PICKS - TOP * N} handed out · {N} teams of {TEAM_SIZE}", None, "", '<a class="ui-btn ui-btn--small" href="#">{{icon:arrow-right}}Go to the event</a>')
        + f"    {snake_grid(PICKS)}\n    {full_teams(PICKS, None)}\n"
    )
