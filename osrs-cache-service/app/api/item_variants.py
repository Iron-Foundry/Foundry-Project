from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import ItemOut
from app.db.models import Item

_VARIANT_SUFFIX = re.compile(r"(\s*\([^)]*\))+$")
_TRAILING_NUMBER = re.compile(r"[\s\-_]*\d+$")


def variant_base_name(name: str) -> str:
    stripped = name
    while True:
        next_stripped = _TRAILING_NUMBER.sub("", _VARIANT_SUFFIX.sub("", stripped))
        if next_stripped == stripped:
            break
        stripped = next_stripped
    return re.sub(r"\s+", " ", stripped).strip().casefold()


@dataclass(frozen=True, slots=True)
class VariantIndex:
    counts: dict[str, int]
    hidden_ids: frozenset[int]


_variant_index_cache: tuple[int, VariantIndex] | None = None


def _pick_primary_id(key: str, members: list[tuple[int, str]]) -> int:
    exact = [item_id for item_id, name in members if name.strip().casefold() == key]
    pool = exact if exact else [item_id for item_id, _ in members]
    return min(pool)


async def variant_index(session: AsyncSession, build_id: int) -> VariantIndex:
    global _variant_index_cache
    if _variant_index_cache is not None and _variant_index_cache[0] == build_id:
        return _variant_index_cache[1]

    result = await session.execute(
        select(Item.item_id, Item.name).where(
            Item.cache_build_id == build_id, Item.name != ""
        )
    )
    groups: dict[str, list[tuple[int, str]]] = {}
    for item_id, name in result.all():
        groups.setdefault(variant_base_name(name), []).append((item_id, name))

    counts: dict[str, int] = {}
    hidden_ids: set[int] = set()
    for key, members in groups.items():
        counts[key] = len(members)
        if len(members) < 2:
            continue
        primary_id = _pick_primary_id(key, members)
        hidden_ids.update(item_id for item_id, _ in members if item_id != primary_id)

    index = VariantIndex(counts=counts, hidden_ids=frozenset(hidden_ids))
    _variant_index_cache = (build_id, index)
    return index


def to_item_out(item: Item, counts: dict[str, int]) -> ItemOut:
    out = ItemOut.model_validate(item)
    out.variant_count = counts.get(variant_base_name(item.name), 1)
    return out
