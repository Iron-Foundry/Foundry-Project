from __future__ import annotations

from pathlib import Path

import numpy as np

from app.models.render_export import delete_render, export_render


def test_export_render_writes_expected_path_and_size(tmp_path: Path) -> None:
    canvas = np.zeros((64, 64, 4), dtype=np.uint8).tobytes()

    relative_path = export_render(
        995, 64, canvas, cache_build_id=1, base_dir=str(tmp_path)
    )

    assert relative_path == "1/995_64.webp"
    assert (tmp_path / relative_path).is_file()


def test_delete_render_removes_file(tmp_path: Path) -> None:
    canvas = np.zeros((32, 32, 4), dtype=np.uint8).tobytes()
    relative_path = export_render(
        1, 32, canvas, cache_build_id=2, base_dir=str(tmp_path)
    )
    assert (tmp_path / relative_path).is_file()

    delete_render(relative_path, base_dir=str(tmp_path))

    assert not (tmp_path / relative_path).is_file()


def test_delete_render_missing_file_is_a_noop(tmp_path: Path) -> None:
    delete_render("9/not_there.webp", base_dir=str(tmp_path))
