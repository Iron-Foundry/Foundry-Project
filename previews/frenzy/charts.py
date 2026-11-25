"""Static SVG charts for the bench: points over time and daily points, drawn from the mock series."""

from html import escape

from mock import DAYS, TEAMS, series
from parts import n

W, H, LEFT, BOTTOM, TOP = 640, 240, 44, 24, 10


def _y(value: float, peak: float) -> float:
    return TOP + (H - TOP - BOTTOM) * (1 - value / peak)


def _x(index: int) -> float:
    return LEFT + (W - LEFT - 8) * index / (len(DAYS) - 1)


def _axes(peak: float) -> str:
    rows = []
    for step in range(5):
        value = peak * step / 4
        y = _y(value, peak)
        rows.append(f'<line class="fz-grid" x1="{LEFT}" x2="{W - 8}" y1="{y:.1f}" y2="{y:.1f}"/>'
                    f'<text x="{LEFT - 6}" y="{y + 4:.1f}" text-anchor="end">{n(value)}</text>')
    labels = "".join(f'<text x="{_x(i):.1f}" y="{H - 6}" text-anchor="middle">{d}</text>' for i, d in enumerate(DAYS))
    return "".join(rows) + labels


def _step_path(values: list[float], peak: float) -> str:
    points = [f"M{_x(0):.1f},{_y(values[0], peak):.1f}"]
    for i in range(1, len(values)):
        points.append(f"H{_x(i):.1f}V{_y(values[i], peak):.1f}")
    return "".join(points)


def points_over_time(teams: list[dict] = TEAMS) -> str:
    peak = max(max(series(t)) for t in teams) * 1.1
    lines = "".join(
        f'<path class="fz-line fz-t{t["t"]}" d="{_step_path(series(t), peak)}"><title>{escape(t["name"])}</title></path>'
        for t in teams
    )
    return (f'<svg class="fz-chart" viewBox="0 0 {W} {H}" role="img" aria-label="Points over time per team">'
            f"{_axes(peak)}{lines}</svg>")


def daily_points(teams: list[dict] = TEAMS) -> str:
    gains = [[b - a for a, b in zip([0] + series(t)[:-1], series(t))] for t in teams]
    peak = max(sum(g[i] for g in gains) for i in range(len(DAYS))) * 1.1
    width = (W - LEFT - 8) / len(DAYS) * 0.6
    bars = []
    for i in range(len(DAYS)):
        base = 0.0
        for team, gain in zip(teams, gains):
            top, bottom = _y(base + gain[i], peak), _y(base, peak)
            bars.append(f'<rect class="fz-t{team["t"]}" x="{_x(i) - width / 2:.1f}" y="{top:.1f}" '
                        f'width="{width:.1f}" height="{bottom - top:.1f}"/>')
            base += gain[i]
    return (f'<svg class="fz-chart" viewBox="0 0 {W} {H}" role="img" aria-label="Daily points gained per team">'
            f'{_axes(peak)}{"".join(bars)}</svg>')


def team_legend(teams: list[dict] = TEAMS, hidden: tuple[str, ...] = ()) -> str:
    labels = "".join(
        f'<label class="{"is-off" if t["name"] in hidden else ""}"><input type="checkbox"'
        f'{"" if t["name"] in hidden else " checked"}><i class="fz-dot fz-bg-t{t["t"]}"></i>{escape(t["name"])}</label>'
        for t in teams
    )
    return f'<div class="ui-legend">{labels}</div>'
