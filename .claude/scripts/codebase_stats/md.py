"""Markdown rendering primitives: aligned tables, bars, human-readable sizes."""

BAR_FULL = "█"
BAR_EMPTY = "░"


def human_size(num_bytes: int) -> str:
    step = 1024.0
    value = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if value < step or unit == "GB":
            if unit == "B":
                return f"{int(value)} B"
            return f"{value:.1f} {unit}"
        value /= step
    return f"{value:.1f} GB"


def num(value: int) -> str:
    return f"{value:,}"


def pct(part: int, whole: int, digits: int = 1) -> str:
    if whole <= 0:
        return "0.0%"
    return f"{part / whole * 100:.{digits}f}%"


def bar(value: float, maximum: float, width: int = 20) -> str:
    if maximum <= 0:
        return BAR_EMPTY * width
    filled = int(round(value / maximum * width))
    filled = max(0, min(width, filled))
    return BAR_FULL * filled + BAR_EMPTY * (width - filled)


def _display_width(text: str) -> int:
    return len(text)


def table(headers: list[str], rows: list[list[str]], align: str = "") -> str:
    """Render a padded GitHub-flavoured markdown table.

    align is a per-column string of 'l' (left), 'r' (right) or 'c'; missing
    entries default to left.
    """
    if not rows:
        return ""
    cols = len(headers)
    align = (align + "l" * cols)[:cols]
    widths = [_display_width(h) for h in headers]
    for row in rows:
        for i in range(cols):
            widths[i] = max(widths[i], _display_width(row[i]))

    def pad(text: str, width: int, mode: str) -> str:
        gap = width - _display_width(text)
        if mode == "r":
            return " " * gap + text
        if mode == "c":
            left = gap // 2
            return " " * left + text + " " * (gap - left)
        return text + " " * gap

    lines = ["| " + " | ".join(pad(headers[i], widths[i], align[i]) for i in range(cols)) + " |"]
    seps = []
    for i in range(cols):
        if align[i] == "r":
            seps.append("-" * (widths[i] + 1) + ":")
        elif align[i] == "c":
            seps.append(":" + "-" * widths[i] + ":")
        else:
            seps.append("-" * (widths[i] + 2))
    lines.append("|" + "|".join(seps) + "|")
    for row in rows:
        lines.append("| " + " | ".join(pad(row[i], widths[i], align[i]) for i in range(cols)) + " |")
    return "\n".join(lines)


def section(title: str, body: str) -> str:
    if not body.strip():
        return ""
    return f"{title}\n\n{body}\n"
