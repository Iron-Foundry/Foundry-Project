"""Fetch the live OSRSClans rows and item images that the frenzy bench draws.

Each named item resolves to its fastest source row. The rows land once in
src/data.json and the images in art/, so a render reads no network. Delete
src/data.json to read the live service again.
"""

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://osrsclans.cc/api/v1"
HEADERS = {"User-Agent": "clan event tracker bench"}
NPC_FOR_SOURCE = {"Ancient chest": "Great Olm", "Monumental chest": "Verzik Vitur",
                  "Chest (Tombs of Amascut)": "Tumeken's Warden", "Grotesque Guardians": "Dusk",
                  "Grand Hallowed Coffin": None}
ITEM_FOR_SOURCE = {"Unsired": 13273}
SPRITE_FOR_GROUP = {"Slayer": 4255}
OUT_OF_SCOPE =("(Deadman)", "Echo", "Nightmare Zone", "Corrupted", "Crystalline")
TIERS = {
    "Easy": ["Abyssal whip", "Dragon boots", "Granite maul", "Zenyte shard", "Tanzanite fang",
             "Magic fang", "Serpentine visage", "Dragon pickaxe"],
    "Medium": ["Tyrannical ring", "Treasonous ring", "Dragon warhammer", "Abyssal dagger",
               "Kraken tentacle", "Voidwaker hilt", "Bandos hilt"],
    "Hard": ["Draconic visage", "Bandos chestplate", "Armadyl helmet", "Saradomin sword",
             "Dragon claws", "Dexterous prayer scroll", "Arcane prayer scroll", "Twisted buckler"],
    "Elite": ["Twisted bow", "Scythe of Vitur (uncharged)", "Tumeken's shadow (uncharged)",
              "Elysian sigil", "Ring of endurance (uncharged)"],
}


def get_json(path: str) -> dict:
    request = urllib.request.Request(API + path, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def hours(row: dict) -> float | None:
    chance = row.get("chancePerRaid") or row.get("chance")
    kph = row.get("killsPerHour")
    return 1 / (chance * kph) if chance and kph else None


def fastest_row(name: str) -> dict:
    query = urllib.parse.urlencode({"q": name, "limit": 100})
    rows = [r for r in get_json(f"/loot-rates?{query}")["items"]
            if r["itemName"] == name and not any(m in r["source"] for m in OUT_OF_SCOPE)]
    if not rows:
        raise SystemExit(f"OSRSClans has no row for {name}")
    return min(rows, key=lambda r: (hours(r) is None, hours(r) or 0))


def fetch_rows() -> dict:
    return {tier: [fastest_row(name) for name in names] for tier, names in TIERS.items()}


def save_images(rows: dict, art: Path) -> None:
    art.mkdir(exist_ok=True)
    for row in (r for tier in rows.values() for r in tier):
        target = art / f"{row['itemId']}.webp"
        if target.exists():
            continue
        url = f"{API}/osrs/items/{row['itemId']}.webp"
        request = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=30) as response:
            target.write_bytes(response.read())


def npc_name(source: str) -> str | None:
    base = source.split("#")[0]
    return NPC_FOR_SOURCE.get(base, base)


def npc_still(npc_id: int) -> bytes | None:
    request = urllib.request.Request(f"{API}/osrs/npcs/{npc_id}.webp", headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        # A lookup match can be a variant with no still; the next match is tried.
        if error.code == 404:
            return None
        raise


def first_still(name: str, art: Path) -> str | None:
    found = get_json(f"/osrs/npcs/lookup?{urllib.parse.urlencode({'name': name, 'limit': 10})}")
    for match in found[0]["matches"] if found else []:
        still = npc_still(match["id"])
        if still is not None:
            (art / f"npc-{match['id']}.webp").write_bytes(still)
            return f"npc-{match['id']}.webp"
    return None


def source_art(source: str, art: Path) -> str | None:
    if source in ITEM_FOR_SOURCE:
        item_id = ITEM_FOR_SOURCE[source]
        request = urllib.request.Request(f"{API}/osrs/items/{item_id}.webp", headers=HEADERS)
        with urllib.request.urlopen(request, timeout=30) as response:
            (art / f"{item_id}.webp").write_bytes(response.read())
        return f"{item_id}.webp"
    name = npc_name(source)
    return first_still(name, art) if name else None


def load_source_art(here: Path, rows: dict) -> dict[str, str | None]:
    cache = here / "src" / "source-art.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    sources = sorted({r["source"].split("#")[0] for tier in rows.values() for r in tier})
    found = {s: source_art(s, here / "art") for s in sources}
    cache.write_text(json.dumps(found, indent=1), encoding="utf-8")
    return found


def load_group_art(here: Path) -> dict[str, str]:
    found = {}
    for group, sprite_id in SPRITE_FOR_GROUP.items():
        target = here / "art" / f"sprite-{sprite_id}.webp"
        if not target.exists():
            request = urllib.request.Request(f"{API}/osrs/sprites/{sprite_id}.webp", headers=HEADERS)
            with urllib.request.urlopen(request, timeout=30) as response:
                target.write_bytes(response.read())
        found[group] = target.name
    return found


def load(here: Path) -> dict:
    cache = here / "src" / "data.json"
    if cache.exists():
        rows = json.loads(cache.read_text(encoding="utf-8"))
    else:
        rows = fetch_rows()
        cache.parent.mkdir(exist_ok=True)
        cache.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    save_images(rows, here / "art")
    return rows


if __name__ == "__main__":
    folder = Path(__file__).resolve().parent
    print(load_source_art(folder, load(folder)))
