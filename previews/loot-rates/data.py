"""Fetch the live OSRSClans rows and item images that the loot-rates bench draws.

The rows land once in src/data.json and the images in art/, so a render reads no
network. Delete src/data.json to read the live service again.
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://osrsclans.cc/api/v1"
HEADERS = {"User-Agent": "clan event tracker bench"}
ITEMS = {"visage": 11286, "tbow": 20997, "endurance": 24844}
QUERIES = {
    "raids": "/loot-rates/sources?category=raid&limit=8",
    "bosses": "/loot-rates/sources?category=boss&limit=14&offset=32",
    "vorkath": "/loot-rates?source=Vorkath%23Post-quest&limit=100",
    "search": "/loot-rates?q=visage&limit=20",
}


def get_json(path: str) -> dict:
    request = urllib.request.Request(API + path, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_rows() -> dict:
    rows = {k: get_json(path)["items"] for k, path in QUERIES.items()}
    for key, item_id in ITEMS.items():
        rows[key] = get_json(f"/loot-rates?item={item_id}&limit=50")["items"]
    return rows


def item_ids(rows: dict) -> set[int]:
    return {
        row["itemId"]
        for key, items in rows.items()
        if key not in ("raids", "bosses")
        for row in items
        if row.get("itemId") is not None
    }


def save_images(ids: set[int], art: Path) -> None:
    art.mkdir(exist_ok=True)
    for item_id in sorted(ids):
        target = art / f"{item_id}.webp"
        if target.exists():
            continue
        url = f"{API}/osrs/items/{urllib.parse.quote(str(item_id))}.webp"
        request = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=30) as response:
            target.write_bytes(response.read())


def load(here: Path) -> dict:
    cache = here / "src" / "data.json"
    if cache.exists():
        rows = json.loads(cache.read_text(encoding="utf-8"))
    else:
        rows = fetch_rows()
        cache.parent.mkdir(exist_ok=True)
        cache.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    save_images(item_ids(rows), here / "art")
    return rows
