"""The frenzy item row of each editor option: today's row and the three rate controls."""

from html import escape

from parts import (
    GHOST_ICON, INPUT_XS, LABEL_XS, OUTLINE_SM, SELECT, SELECT_CONTENT, SELECT_ITEM, by_hours, denom_label, drop_denom,
    hours_label, icon, item_image, kph_label, measurer, source_name,
)


def field(label: str, value: str, placeholder: str = "") -> str:
    return (
        f'<div><label class="{LABEL_XS}">{label}</label>'
        f'<input class="{INPUT_XS}" value="{value}" placeholder="{placeholder}"></div>'
    )


def read_field(label: str, value: str) -> str:
    return f'<div><p class="{LABEL_XS}">{label}</p><p class="text-xs tabular-nums pt-1">{value}</p></div>'


def row_head(row: dict) -> str:
    return (
        f'<div class="flex items-center gap-2">{item_image(row)}'
        f'<div class="flex-1"><input class="{INPUT_XS} h-8 text-sm" value="{escape(row["itemName"])}"></div>'
        f'<button class="{GHOST_ICON}" title="Lock points (exclude from recalculation)">{icon("unlock")}</button>'
        f'<button class="{GHOST_ICON}" title="Remove item">{icon("trash")}</button></div>'
        f'<div class="grid grid-cols-3 gap-1.5">{field("Points", "40")}'
        f'{field("Required", "1")}{field("Dup required", "1")}</div>'
    )


def hand_grid(row: dict, kph: str) -> str:
    denom = drop_denom(row)
    hours = f"H/D: {denom / float(kph):.1f}h" if denom and kph else ""
    return (
        f'<div class="grid grid-cols-3 gap-1.5">{field("Drop denom", str(denom or ""), "e.g. 512")}'
        f'{field("KPH", kph, "e.g. 30")}<div class="flex flex-col justify-end pb-1">'
        f'<p class="text-[10px] text-muted-foreground leading-none">{hours}</p></div></div>'
    )


def no_rate_note(row: dict) -> str:
    return (
        f'<p class="flex items-center gap-1 text-xs text-yellow-500">{icon("alert")}'
        f"{source_name(row)} has no kill rate. Unbalanced until KPH is set.</p>"
    )


def rate_today(row: dict) -> str:
    kph = row.get("killsPerHour")
    return hand_grid(row, f"{kph:g}" if kph else "")


def rate_line(row: dict) -> str:
    if row.get("killsPerHour") is None:
        line = no_rate_note(row)
    else:
        line = (
            f'<p class="flex-1 text-xs text-muted-foreground">{source_name(row)} · {denom_label(row)}'
            f" · {kph_label(row)}/h ({measurer(row)}) · {hours_label(row)} a drop</p>"
        )
    change = f'<button class="{OUTLINE_SM}">Change</button>'
    return f'<div class="flex items-center gap-2">{line}{change}</div>{rate_today(row)}'


def rate_select(row: dict, menu: str = "") -> str:
    popper = f'<div class="absolute z-50 top-full mt-1 w-full">{menu}</div>' if menu else ""
    trigger = (
        f'<label class="{LABEL_XS}">Rate source</label><div class="relative"><button class="{SELECT}">'
        f'<span class="truncate">{source_name(row)} · {hours_label(row)} a drop</span>'
        f'{icon("chevron-down", "size-4 opacity-50")}</button>{popper}</div>'
    )
    if row.get("killsPerHour") is None:
        return trigger + no_rate_note(row) + hand_grid(row, "")
    edit = f'<button class="{OUTLINE_SM} self-end">{icon("pencil")}By hand</button>'
    values = (
        f'<div class="grid grid-cols-4 gap-1.5">{read_field("Drop denom", denom_label(row))}'
        f'{read_field("KPH", kph_label(row))}{read_field("H/D", hours_label(row))}{edit}</div>'
    )
    return trigger + values


def rate_select_open(rows: list[dict], chosen: dict) -> str:
    items = []
    for row in by_hours(rows):
        mark = icon("check-square", "size-4") if row is chosen else ""
        items.append(
            f'<div class="{SELECT_ITEM}{" bg-muted" if row is chosen else ""}">'
            f'<span class="flex-1 truncate">{source_name(row)}</span>'
            f'<span class="tabular-nums text-muted-foreground">{hours_label(row)}</span>'
            f'<span class="absolute right-2 flex size-3.5 items-center justify-center">{mark}</span></div>'
        )
    return f'<div class="{SELECT_CONTENT} max-h-72">{"".join(items)}</div>'


def rate_from_card(row: dict) -> str:
    if row.get("killsPerHour") is None:
        return no_rate_note(row) + hand_grid(row, "")
    at = " at 65,000 points" if row.get("chancePerRaid") else ""
    return (
        f'<div class="flex items-center gap-2"><p class="flex-1 text-xs text-muted-foreground">'
        f"From {source_name(row)}{at}: {denom_label(row)}, {kph_label(row)} kills/h "
        f'({measurer(row)}), {hours_label(row)} a drop</p>'
        f'<button class="{GHOST_ICON}" title="Set the rate by hand">{icon("pencil")}</button></div>'
    )


def item_row(row: dict, rate: str) -> str:
    return f'<div class="rounded border bg-muted/30 p-2 space-y-1.5">{row_head(row)}{rate}</div>'
