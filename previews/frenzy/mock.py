"""The mock event the frenzy bench draws. Items and rates are live OSRSClans rows; the rest is mock."""

from parts import TIER_NAMES

EVENT = {"name": "PvM Frenzy: Winter 2026", "dates": "18 Nov 2026 - 2 Dec 2026", "left": "7d remaining",
         "days_left": 7, "cap": 6000, "version": 7, "wom": 81234}
BUDGET = {"Easy": 15, "Medium": 25, "Hard": 30, "Elite": 30}
TEAMS = [
    {"name": "Gold Rush", "slug": "gold-rush", "icon": "IF_YELLOW.png", "tiers": [520, 610, 780, 420],
     "act": 160, "mile": 140, "pending": 85, "t": 1},
    {"name": "Green Machine", "slug": "green-machine", "icon": "IF_GREEN.png", "tiers": [560, 540, 640, 390],
     "act": 120, "mile": 110, "pending": 20, "t": 2},
    {"name": "Purple Haze", "slug": "purple-haze", "icon": "IF_PURPLE.png", "tiers": [480, 520, 610, 0],
     "act": 140, "mile": 90, "pending": 0, "t": 3},
    {"name": "Blue Steel", "slug": "blue-steel", "icon": "IF_ELECTRIC_BLUE.png", "tiers": [500, 410, 330, 0],
     "act": 90, "mile": 120, "pending": 40, "t": 4},
    {"name": "Iron Will", "slug": "iron-will", "icon": "", "tiers": [390, 300, 210, 0],
     "act": 60, "mile": 70, "pending": 0, "t": 5},
]
for _team in TEAMS:
    _team["total"] = sum(_team["tiers"]) + _team["act"] + _team["mile"]

PLAYERS = ["xTinyAnvil", "Quench", "Slag Heap", "Hammer Time", "Mossy Ingot", "Bellows Bob", "Cinder Pile",
           "Ferrous Fen", "Ore Wolf", "Tin Can Tom", "Rune Rae", "Smelt Steve", "Ashen Ivy", "Coalface"]
OBTAINED = {"Abyssal whip": 2, "Dragon boots": 1, "Zenyte shard": 1, "Tanzanite fang": 2, "Magic fang": 1,
            "Serpentine visage": 1, "Dragon pickaxe": 2, "Tyrannical ring": 2, "Voidwaker hilt": 2,
            "Kraken tentacle": 1, "Bandos chestplate": 1, "Saradomin sword": 2, "Dexterous prayer scroll": 1,
            "Arcane prayer scroll": 1, "Twisted bow": 1}
CARD_FOR_ITEM = {"Abyssal whip": "Slayer", "Granite maul": "Slayer", "Kraken tentacle": "Slayer",
                 "Abyssal dagger": "Slayer", "Dragon warhammer": "Slayer", "Dragon boots": "Miscellaneous",
                 "Zenyte shard": "Miscellaneous"}
ACTIVITIES = [
    {"name": "Chambers of Xeric", "tiers": [5, 15, 30, 50], "current": 34, "step": 25, "unit": "KC", "mult": 1.5},
    {"name": "Tombs of Amascut", "tiers": [5, 15, 30, 50], "current": 12, "step": 25, "unit": "KC", "mult": 1.5},
    {"name": "Zulrah", "tiers": [50, 150, 300, 500], "current": 520, "step": 15, "unit": "KC", "mult": 1.25},
]
MILESTONES = {
    "Kill Count": [{"name": "Vorkath", "tiers": [50, 100, 250, 500], "current": 140, "step": 20, "unit": "KC", "mult": 1}],
    "Experience": [{"name": "Slayer", "tiers": [250_000, 500_000, 1_000_000, 2_000_000], "current": 640_000,
                    "step": 20, "unit": "XP", "mult": 1}],
    "Clue Scrolls": [{"name": "Clue Scrolls (Hard)", "tiers": [5, 10, 20, 40], "current": 22, "step": 15,
                      "unit": "Scrolls", "mult": 1}],
}
MULTIPLIERS = [
    {"name": "Raid kit", "factor": 1.25, "desc": "Both prayer scrolls unlock a bonus on the raid chests.",
     "affects": ["Ancient chest, Challenge Mode"], "needs": ["Dexterous prayer scroll", "Arcane prayer scroll"]},
    {"name": "Serpent set", "factor": 1.5, "desc": "All three Zulrah uniques unlock a bonus on Zulrah.",
     "affects": ["Zulrah"], "needs": ["Tanzanite fang", "Magic fang", "Serpentine visage"]},
]
BOARDS = [
    ("Chambers of Xeric", [("Slag Heap", 41), ("Quench", 37), ("Ore Wolf", 30), ("Rune Rae", 22), ("Coalface", 18)]),
    ("Zulrah", [("Ferrous Fen", 612), ("Cinder Pile", 540), ("Bellows Bob", 388), ("Quench", 301), ("Ashen Ivy", 250)]),
    ("Corporeal Beast", [("Hammer Time", 96), ("Mossy Ingot", 71), ("Tin Can Tom", 54), ("Smelt Steve", 40),
                         ("xTinyAnvil", 33)]),
]
SUBMISSIONS = [
    ("Quench", "Gold Rush", "item", "Hard / Kree'arra / Armadyl helmet x1", "Trackscape", False, "pending", "25 Nov 14:02"),
    ("Ore Wolf", "Green Machine", "item", "Elite / Corporeal Beast / Elysian sigil x1", "Discord OCR", False, "pending", "25 Nov 13:40"),
    ("Cinder Pile", "Purple Haze", "activity", "Tombs of Amascut: 16", "Web", False, "pending", "25 Nov 12:55"),
    ("Slag Heap", "Gold Rush", "item", "Elite / Ancient chest / Twisted bow x1", "Trackscape", True, "approved", "25 Nov 11:12"),
    ("Rune Rae", "Blue Steel", "milestone", "Slayer: 512,400", "Discord Manual", False, "rejected", "24 Nov 22:30"),
    ("Mossy Ingot", "Gold Rush", "item", "Medium / Callisto / Tyrannical ring x1", "Trackscape", True, "approved", "24 Nov 21:08"),
]
VERSIONS = [(7, "25 Nov 2026", "Hammer Time"), (6, "22 Nov 2026", "Quench"), (5, "19 Nov 2026", "Hammer Time"),
            (4, "17 Nov 2026", "Slag Heap"), (3, "12 Nov 2026", "Hammer Time")]
DAYS = ["18 Nov", "19 Nov", "20 Nov", "21 Nov", "22 Nov", "23 Nov", "24 Nov", "25 Nov"]
SHAPES = [0.08, 0.2, 0.31, 0.45, 0.58, 0.7, 0.86, 1.0]


def series(team: dict) -> list[float]:
    power = 0.75 + team["t"] * 0.1
    return [round(team["total"] * s**power) for s in SHAPES]


def item_from(row: dict, obtained: dict) -> dict:
    chance = row.get("chancePerRaid") or row.get("chance")
    kph = row.get("killsPerHour")
    hours = 1 / (chance * kph) if chance and kph else None
    points = max(10, min(400, round(hours * 6 / 5) * 5)) if hours else 150
    return {"name": row["itemName"], "item_id": row["itemId"], "source": row["source"].replace("#", ", "),
            "denom": round(1 / chance) if chance else None, "kph": kph, "hours": hours,
            "measurer": row.get("killRateSource"), "points": points, "required": 1, "dup": 1,
            "have": obtained.get(row["itemName"], 0), "locked": hours is None, "raid": bool(row.get("chancePerRaid"))}


def template(rows: dict) -> list[dict]:
    tiers = []
    for name in TIER_NAMES:
        sources: dict[str, list[dict]] = {}
        for row in rows[name]:
            item = item_from(row, OBTAINED)
            sources.setdefault(CARD_FOR_ITEM.get(item["name"], item["source"]), []).append(item)
        tiers.append({"name": name, "budget": BUDGET[name], "sources": sources})
    return tiers
