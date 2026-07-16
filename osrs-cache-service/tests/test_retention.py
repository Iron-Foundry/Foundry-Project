from __future__ import annotations

from pathlib import Path

import pytest

from app.services import retention


@pytest.fixture
def volumes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path, Path]:
    sprites, icons, renders = (
        tmp_path / "sprites",
        tmp_path / "icons",
        tmp_path / "renders",
    )
    for base in (sprites, icons, renders):
        base.mkdir()
    monkeypatch.setattr(
        retention, "_build_dirs", lambda: (str(sprites), str(icons), str(renders))
    )
    return sprites, icons, renders


def _seed_build(base: Path, build_id: int) -> Path:
    build_dir = base / str(build_id)
    build_dir.mkdir()
    (build_dir / "asset.webp").write_bytes(b"x")
    return build_dir


def test_current_build_directory_is_kept(volumes: tuple[Path, Path, Path]) -> None:
    sprites, icons, renders = volumes
    for base in (sprites, icons, renders):
        _seed_build(base, 88)

    removed = retention.purge_superseded_dirs(88)

    assert removed == 0
    for base in (sprites, icons, renders):
        assert (base / "88" / "asset.webp").is_file()


def test_superseded_build_directories_are_removed_from_every_volume(
    volumes: tuple[Path, Path, Path],
) -> None:
    sprites, icons, renders = volumes
    for base in (sprites, icons, renders):
        _seed_build(base, 87)
        _seed_build(base, 88)

    removed = retention.purge_superseded_dirs(88)

    assert removed == 3
    for base in (sprites, icons, renders):
        assert not (base / "87").exists()
        assert (base / "88").is_dir()


def test_orphaned_build_directories_are_reclaimed(
    volumes: tuple[Path, Path, Path],
) -> None:
    """A build that never became current leaves files with no DB row - the old
    delete-the-previous-build logic could never find these."""
    _, icons, _ = volumes
    for build_id in (71, 74, 83, 999):
        _seed_build(icons, build_id)
    _seed_build(icons, 88)

    removed = retention.purge_superseded_dirs(88)

    assert removed == 4
    assert [p.name for p in icons.iterdir()] == ["88"]


def test_missing_volume_is_not_an_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        retention, "_build_dirs", lambda: (str(tmp_path / "not-mounted"),)
    )

    assert retention.purge_superseded_dirs(88) == 0
