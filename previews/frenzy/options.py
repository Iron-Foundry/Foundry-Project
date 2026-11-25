"""The bench rows: each candidate frame with its name and note, and today's baseline rows."""

import event_frames
import staff_editor
import staff_ops
import team_frames
from mock import template


def row(surface: str, option_id: str, name: str, note: str, html: str, public: bool = True) -> dict:
    return {"surface": surface, "id": option_id, "name": name, "note": note, "html": html, "public": public}


def today(name: str, note: str, src: str) -> dict:
    return {"surface": "today", "id": "", "name": name, "note": note, "src": src, "public": True}


def picked(tiers: list[dict], art: dict) -> list[dict]:
    card_note = ("Each source card shows its NPC from OSRSClans. An item is yellow at 1/2 and green at 2/2. The title is "
                 "yellow when all items are at least 1/2 and green when all are 2/2. The (i) button holds the rates.")
    return [
        row("picked", "event-f1", "Event page: F1", "Unchanged from round 1.", event_frames.f1()),
        row("picked", "team-f3", "Team page: F3", card_note, team_frames.f3(tiers, art)),
        row("picked", "team-f3-info", "Team page: F3, (i) open on Zulrah", "Kills per hour, the measure, and the chance and hours a drop of each item.", team_frames.f3(tiers, art, ("Easy", "Zulrah"))),
        row("picked", "team-f3-group", "Team page: F3, (i) open on a typed card", "Slayer is a typed card in the Medium tier. Its (i) panel lists the source and kill rate of each item.", team_frames.f3(tiers, art, ("Medium", "Slayer"))),
        row("picked", "staff-f2", "Staff page: F2 Workspace", "Zulrah, a card named after its source. The card image is the Zulrah NPC.", staff_editor.f2(tiers), False),
        row("picked", "staff-f2-group", "Staff page: F2, a typed card", "Slayer in the Medium tier. The card name is free text and the image is picked apart from it. Each item keeps its own rate source, and Change picks it.", staff_editor.f2(tiers, "Slayer", 1), False),
        row("picked", "staff-f2-history", "Staff page: F2 version history", "Unchanged from round 1.", staff_ops.history_f2(), False),
    ]


def sections(rows: dict, art: dict) -> dict[str, list[dict]]:
    tiers = template(rows)
    return {
        "picked": picked(tiers, art),
        "event": [
            row("event", "f1", "F1 Standings table", "One standings table with a column per tier, activities and milestones. The charts sit on the page under it, with the range and team filters.", event_frames.f1()),
            row("event", "f2", "F2 Race lanes", "Each team is one lane on a shared scale, with the gap to the leader. The days left lead the head. Charts open in a sheet.", event_frames.f2()),
            row("event", "f2-sheet", "F2, Charts open", "The analytics sheet: range, team toggles, standings, points over time and daily points.", event_frames.charts_sheet()),
            row("event", "f3", "F3 Tier leaders", "A strip of all teams by total, then one board per tier. The charts and the leaderboards share the lower row.", event_frames.f3()),
            today("Today", "Today's page structure in the picked Monogram skin (RDM-2 round 6).", "../site-theme/frame-mark-frenzy.html"),
        ],
        "team": [
            row("team", "f1", "F1 Item table", "Score tiles, then all items in one table grouped by tier, with the source, the OSRSClans rate and the progress of each item.", team_frames.f1(tiers)),
            row("team", "f2", "F2 Tier cards and item tiles", "Four tier cards pick the tier. Each source is a card of item tiles. An obtained item is bright, a missing one dim.", team_frames.f2(tiers)),
            row("team", "f3", "F3 One page with a rail", "No tabs. A rail jumps between the tiers, activities, milestones, multipliers and charts on one page.", team_frames.f3(tiers)),
            today("Today", "Today's page structure in the picked Monogram skin.", "../site-theme/frame-mark-frenzy-team.html"),
        ],
        "staff": [
            row("staff", "f1-editor", "F1 Item sheet", "All items of the template in one editable table. The rate source column picks an OSRSClans row per item.", staff_editor.f1(tiers), False),
            row("staff", "f1-events", "F1, Events tab", "The event form, its teams in a table, and the event list beside them.", staff_ops.events_f1(), False),
            row("staff", "f1-submissions", "F1, Submissions tab", "Today's filters as one panel above the submissions table.", staff_ops.submissions_f1(), False),
            row("staff", "f2-editor", "F2 Workspace", "Tiers and sources in a tree, the picked source's items in the middle, budgets and save on the right.", staff_editor.f2(tiers), False),
            row("staff", "f2-history", "F2, Version history open", "The version list and a diff of both sides against the current version.", staff_ops.history_f2(), False),
            row("staff", "f3-editor", "F3 Event first", "The page opens on the event and its stage. The template is one tab of the event, edited as source cards.", staff_editor.f3(tiers), False),
            row("staff", "f3-queue", "F3, Review queue", "Pending submissions as a queue with a note, Approve and Reject. Reviewed rows follow.", staff_ops.queue_f3(tiers), False),
            today("Today", "Today's item rows of the template editor, from the loot-rates bench.", "../loot-rates/frame-editor-today.html"),
        ],
    }
