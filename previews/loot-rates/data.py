"""Fetch the live OSRSClans rows and item images that the loot-rates bench draws.

The rows land once in src/data.json and the images in art/, so a render reads no
network. A query missing from src/data.json is fetched on the next render. Delete
src/data.json to read the live service again.
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
    "hallowed": "/loot-rates/sources?q=Hallowed&limit=20",
    "coffin": "/loot-rates?source=Grand%20Hallowed%20Coffin&limit=50",
}
SOURCE_LISTS = ("raids", "bosses", "hallowed")


def get_json(path: str) -> dict:
    request = urllib.request.Request(API + path, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def missing_rows(cached: dict) -> dict:
    rows = {k: get_json(path)["items"] for k, path in QUERIES.items() if k not in cached}
    for key, item_id in ITEMS.items():
        if key not in cached:
            rows[key] = get_json(f"/loot-rates?item={item_id}&limit=50")["items"]
    return rows


def item_ids(rows: dict) -> set[int]:
    return {
        row["itemId"]
        for key, items in rows.items()
        if key not in SOURCE_LISTS
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
    rows = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else {}
    fetched = missing_rows(rows)
    if fetched:
        rows.update(fetched)
        cache.parent.mkdir(exist_ok=True)
        cache.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    save_images(item_ids(rows), here / "art")
    return rows
