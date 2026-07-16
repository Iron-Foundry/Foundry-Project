"""Dispatches an OSRS model group (archive 7) to the right format decoder.

Both formats seen in the current live cache are handled (verified empirically:
34,616 type3 groups, 26,990 type2 groups, 0 old/type1). Old-format and type1
models (pre-2010-era, not present in any current live build) are out of
scope - raised as ModelDecodeError so the caller can skip that item's icon
gracefully, matching the "best-effort, never abort ingestion" pattern used
throughout this service.
"""

from __future__ import annotations

from app.models.definition import ModelDefinition
from app.models.loader_type2 import decode_type2
from app.models.loader_type3 import decode_type3


class ModelDecodeError(RuntimeError):
    pass


def decode_model(model_id: int, data: bytes) -> ModelDefinition:
    """Decodes raw geometry only - vertex normals are computed per-render in
    the rasterizer, from the *resized* vertices (see definition.py)."""
    if len(data) < 2:
        raise ModelDecodeError(f"model {model_id} group too short")

    last, second_last = data[-1], data[-2]
    if last == 0xFD and second_last == 0xFF:
        return decode_type3(model_id, data)
    if last == 0xFE and second_last == 0xFF:
        return decode_type2(model_id, data)
    raise ModelDecodeError(f"model {model_id} uses an unsupported old/type1 format")
