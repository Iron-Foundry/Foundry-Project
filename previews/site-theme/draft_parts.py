"""HTML parts of the frenzy draft bench pages, drawn from draft_mock."""

from draft_mock import CAPTAINS, TEAM_SIZE, cc, snake_captain

INTRO = """    <section class="ui-intro ui-intro--actions">
      <div><p class="ui-kicker">PVM Frenzy draft · {mode}</p><h1 class="ui-h1 ui-h1--page">Winter Frenzy</h1></div>
      {aside}
    </section>
"""


def intro(mode: str, aside: str = '<span class="ui-draft-live">Live</span>') -> str:
    return INTRO.format(mode=mode, aside=aside)


def ordinal(n: int) -> str:
    return f"{n}{'st' if n == 1 else 'nd' if n == 2 else 'rd' if n == 3 else 'th'}"


def order_strip(pick: int, label: str) -> str:
    """The order of the round the pick is in, the current captain underlined."""
    n = len(CAPTAINS)
    first = ((pick - 1) // n) * n + 1
    rnd = (pick - 1) // n + 1
    items = [f'<li><span class="ui-draft-num">Round {rnd}</span>{{{{icon:{"arrow-right" if rnd % 2 else "chevron-left"}}}}}</li>']
    for p in range(first, first + n):
        now = ' class="is-now"' if p == pick else ""
        items.append(f'<li{now}><span class="ui-draft-num">{p}</span><b>{CAPTAINS[snake_captain(p)]}</b></li>')
    items.append(f'<li><span class="ui-draft-num">{label}</span></li>')
    return f'      <ol class="ui-draft-order" aria-label="Round {rnd} order">{"".join(items)}</ol>\n'


def turn_head(title: str, detail: str, pick: int | None, strip_label: str, aside: str = "") -> str:
    strip = order_strip(pick, strip_label) if pick else ""
    return (
        '    <section class="ui-draft-turn" aria-label="Current pick">\n'
        f'      <div class="ui-draft-turn-main"><div><b>{title}</b><p>{detail}</p></div>{aside}</div>\n'
        f"{strip}    </section>\n"
    )


def team_column(i: int, picks: list[tuple[int, str, int]], next_pick: int | None, kinds: dict[int, str]) -> str:
    """A team: captain, count against size, its latest five picks and the roster link."""
    now = next_pick is not None and snake_captain(next_pick) == i
    rows = []
    if now:
        rows.append(f'<li class="is-empty is-next"><span class="ui-draft-num">{next_pick}</span><span class="ui-name">Picking now</span></li>')
    drafted = [p for p in picks if kinds.get(p[0]) != "auto"]
    shown = drafted if kinds else list(reversed(picks))[:5 - len(rows)]
    for pick, name, pts in shown:
        rows.append(f'<li><span class="ui-draft-num">{pick}</span><span class="ui-name">{name}</span>{cc(pts)}</li>')
    handed = len(picks) - len(drafted)
    if kinds and handed:
        rows.append(f'<li class="is-empty"><span class="ui-draft-num">+{handed}</span><span class="ui-name">handed out by the snake</span></li>')
    count = len(picks) + 1
    return (
        f'      <section class="ui-draft-team{" is-now" if now else ""}">'
        f'<header><b>{CAPTAINS[i]}</b><span>{count} / {TEAM_SIZE} · picks {ordinal(i + 1)} in odd rounds</span></header>'
        f'<p class="ui-kicker">{"Top picks" if kinds else "Latest picks"}</p><ol>{"".join(rows)}</ol>'
        f'<a class="ui-link" href="#">Full roster</a></section>\n'
    )


def board(teams: dict[int, list[tuple[int, str, int]]], next_pick: int | None, kinds: dict[int, str] | None = None) -> str:
    cols = "".join(team_column(i, teams[i], next_pick, kinds or {}) for i in range(len(CAPTAINS)))
    return f'    <div class="ui-draft-board">\n{cols}    </div>\n'


def pool(rows: list[tuple[str, int]], button: str | None, total: int) -> str:
    """The pool head with search, rank filter and sort, over a scrolling list of signups."""
    items = ['<li class="ui-draft-colhead"><span>RSN</span><span>CC Rank</span><span class="ui-val">Points</span><span></span></li>']
    for name, pts in rows[:14]:
        action = f'<button type="button" class="ui-btn ui-btn--small">{button}</button>' if button else "<span></span>"
        items.append(f'<li><span class="ui-name">{name}</span>{cc(pts)}<span class="ui-val">{pts:,}</span>{action}</li>')
    return (
        '    <section class="ui-draft-pool">\n'
        f'      <div class="ui-draft-pool-head"><h2 class="ui-h3">Available <small>{len(rows)} of {total} signups</small></h2>'
        '<label class="ui-search">{{icon:search}}<input type="search" placeholder="Search RSN..." aria-label="Search RSN"></label>'
        '<button type="button" class="ui-select">{{icon:filter}}All ranks{{icon:chevron-down}}</button>'
        '<button type="button" class="ui-select">Sort: Ranking points{{icon:chevron-down}}</button></div>\n'
        f'      <ol class="ui-draft-rows ui-draft-scroll">{"".join(items)}</ol>\n'
        "    </section>\n"
    )
