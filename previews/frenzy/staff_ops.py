"""The staff event, team and submission candidates, and the version history dialog."""

from html import escape

from mock import EVENT, SUBMISSIONS, TEAMS, VERSIONS
from parts import filterline, ic, select, team_img, tool
from staff_editor import SAVE, event_bar
from staff_parts import TEMPLATE_NAME, field, pick_field, remove_button, staff_head

STATUS = {"pending": "ui-status--soon", "approved": "ui-status--done", "rejected": "ui-status--closed"}


def team_row(i: int, team: dict) -> str:
    up = f'<button type="button" class="ui-icon-btn" title="Move up"{" disabled" if i == 0 else ""}>{ic("chevron-up")}</button>'
    down = f'<button type="button" class="ui-icon-btn" title="Move down"{" disabled" if i == len(TEAMS) - 1 else ""}>{ic("chevron-down")}</button>'
    return (f'<tr><td><span class="fz-rowtools">{up}{down}</span></td><td><span class="fz-team">{team_img(team)}'
            f'<b>{escape(team["name"])}</b></span></td><td class="fz-hide-phone ui-muted">{team["slug"]}</td>'
            f'<td class="fz-num">{3 + team["t"]}</td><td><span class="fz-rowtools"><button type="button" class="ui-icon-btn" '
            f'title="Edit team">{ic("pencil")}</button>{remove_button("team")}</span></td></tr>')


def events_f1() -> str:
    events = [(EVENT["name"], "18 Nov - 2 Dec 2026", "Active", "ui-status--live"),
              ("PvM Frenzy: Autumn 2026", "1 Sep - 15 Sep 2026", "Ended", ""),
              ("PvM Frenzy: Spring 2027", "No dates set", "Draft", "ui-status--soon")]
    rows = "".join(f'<tr class="{"is-own" if i == 0 else ""}"><td>{escape(nm)}</td><td class="fz-hide-phone">{d}</td>'
                   f'<td><span class="ui-status {c}">{s}</span></td></tr>' for i, (nm, d, s, c) in enumerate(events))
    listing = (f'<div class="fz-section-head"><h2 class="ui-h2">Events</h2>{tool("New event", "plus")}</div>'
               f'<div class="ui-scroll"><table class="ui-table ui-table--rows"><thead><tr><th>Name</th>'
               f'<th class="fz-hide-phone">Dates</th><th>Status</th></tr></thead><tbody>{rows}</tbody></table></div>')
    form = (f'<section class="ui-panel ui-form"><div class="fz-section-head"><h2 class="ui-h2">{EVENT["name"]}</h2>'
            f'<div class="ui-tools">{tool("Sync WOM", "download")}{tool("Deactivate")}{SAVE}</div></div>'
            f'<div class="ui-form-row">{field("Event name", EVENT["name"])}{pick_field("Template", TEMPLATE_NAME + " v7")}</div>'
            f'<div class="ui-form-row">{field("WOM competition id", str(EVENT["wom"]))}{field("Starts at", "18/11/2026 18:00")}</div>'
            f'<div class="ui-form-row">{field("Ends at", "02/12/2026 18:00")}<span></span></div></section>')
    teams = "".join(team_row(i, t) for i, t in enumerate(TEAMS))
    team_table = (f'<section><div class="fz-section-head"><h2 class="ui-h2">Teams {len(TEAMS)}/12</h2>'
                  f'{tool("Add team", "plus")}</div><div class="ui-scroll"><table class="ui-table"><thead><tr><th>Order</th>'
                  f'<th>Team</th><th class="fz-hide-phone">Slug</th><th class="fz-num">Players</th><th></th></tr></thead>'
                  f'<tbody>{teams}</tbody></table></div></section>')
    delete = (f'<div class="ui-tools"><button type="button" class="ui-tool ui-tool--danger" disabled>{ic("trash")}'
              f'Delete event</button><span class="ui-hint">Deactivate before deleting.</span></div>')
    return (staff_head("Events")
            + f'<div class="fz-two"><div class="fz-stack">{form}{team_table}{delete}</div><div>{listing}</div></div>')


def submissions_f1() -> str:
    labels = [("Player RSN", "Any"), ("Team", "Any"), ("Status", "Pending"), ("Type", "Item"), ("Source", "Any"),
              ("Auto-approved", "Any"), ("Submitted after", "dd/mm/yyyy"), ("Submitted before", "dd/mm/yyyy")]
    filters = "".join(pick_field(k, v) for k, v in labels)
    auto = ' <span class="fz-done">(auto)</span>'
    rows = "".join(
        f'<tr><td>{p}</td><td>{t}</td><td>{k.title()}</td><td>{escape(d)}</td><td>{s}{auto if a else ""}</td>'
        f'<td><span class="ui-status {STATUS[st]}">{st}</span></td><td class="ui-muted">{at}</td><td><span class="fz-rowtools">'
        f'<button type="button" class="ui-icon-btn" title="Approve">{ic("check-square")}</button>'
        f'<button type="button" class="ui-icon-btn" title="Reject">{ic("x")}</button>{remove_button("submission")}</span></td></tr>'
        for p, t, k, d, s, a, st, at in SUBMISSIONS
    )
    cols = "".join(f"<th>{c}</th>" for c in ["Player", "Team", "Type", "Details", "Source", "Status", "Submitted", ""])
    bar = (f'<div class="ui-toolbar"><label class="ui-search">{ic("search")}<input placeholder="Search player, item, boss, '
           f'activity..."></label>{tool("Filters 2", "filter")}{tool("Clear all")}<span class="ui-muted">6 results</span></div>')
    return (staff_head("Submissions", select(EVENT["name"])) + bar + f'<section class="ui-panel fz-filters">{filters}</section>'
            + f'<div class="ui-scroll"><table class="ui-table ui-table--data"><thead><tr>{cols}</tr></thead><tbody>{rows}'
            f'</tbody></table></div><p class="ui-pagerbar">1 / 1</p>')


def claim(sub: tuple, images: dict) -> str:
    player, team, kind, detail, source, auto, status, at = sub
    name = detail.split(" / ")[-1].rsplit(" x", 1)[0]
    art = (f'<img src="art/{images[name]}.webp" alt="{escape(name)}">' if name in images
           else f'<span class="ui-feed-icon">{ic("swords" if kind == "activity" else "target")}</span>')
    if status == "pending":
        acts = (f'<input class="ui-input" placeholder="Review note">{tool("Reject", "x")}'
                f'<button type="button" class="ui-btn ui-btn--small">Approve</button>')
    else:
        other = tool("Reject", "x") if status == "approved" else tool("Approve", "check-square")
        acts = f'<span class="ui-status {STATUS[status]}">{status}{" (auto)" if auto else ""}</span>{other}'
    return (f'<article class="fz-claim">{art}<div class="fz-claim-text"><b>{escape(detail)}</b><span class="fz-sub">'
            f'{player} · {team} · {source} · {at}</span></div><div class="fz-claim-actions">{acts}{remove_button("submission")}</div></article>')


def queue_f3(tiers: list[dict]) -> str:
    images = {i["name"]: i["item_id"] for t in tiers for items in t["sources"].values() for i in items}
    bar = (f'<div class="ui-toolbar ui-toolbar--split">{filterline("Status", ["Pending 3", "Approved", "Rejected", "All"], "Pending 3")}'
           f'<div class="ui-tools"><label class="ui-search">{ic("search")}<input placeholder="Search player or item"></label>'
           f'{select("Team: All")}{select("Source: All")}{tool("More filters", "filter")}</div></div>')
    pending = "".join(claim(s, images) for s in SUBMISSIONS if s[6] == "pending")
    done = "".join(claim(s, images) for s in SUBMISSIONS if s[6] != "pending")
    return (event_bar("Review queue 3") + bar + f'<div class="fz-queue">{pending}</div>'
            + f'<h2 class="ui-h3">Reviewed today</h2><div class="fz-queue">{done}</div>')


def history_f2() -> str:
    items = "".join(f'<li class="{"is-active" if v == 6 else ""}"><b>v{v}{" (current)" if v == 7 else ""}</b>'
                    f'<small>{d} · {who}</small></li>' for v, d, who in VERSIONS)
    diff = ('<span>"name": "Zulrah",</span><span class="is-old">  "points": 60,</span><span class="is-new">  "points": 55,</span>'
            '<span>  "required": 1,</span><span class="is-old">  "kph": 40</span><span class="is-new">  "kph": 46</span>'
            '<span>"name": "Grand Hallowed Coffin",</span><span class="is-new">  "points_locked": true</span>')
    body = (f'<div class="fz-history"><ol>{items}</ol><div class="fz-stack fz-pad">'
            f'<div class="fz-section-head"><b>v6 compared with v7</b>{tool("Restore this version", "undo")}</div>'
            f'<pre class="fz-diff">{diff}</pre></div></div>')
    return (f'<div class="ui-overlay"><div class="ui-dialog fz-dialog--wide"><div class="ui-dialog-head">'
            f'<h2 class="ui-h3">Version history · {TEMPLATE_NAME}</h2><button type="button" class="ui-icon-btn" '
            f'aria-label="Close">{ic("x")}</button></div>{body}</div></div>')
