from pathlib import Path

from app.db.memory import _store_path


def test_store_path_follows_storage_dir_when_no_explicit_store(monkeypatch, tmp_path):
    storage_dir = tmp_path / "landweaver-storage"
    monkeypatch.delenv("LANDWEAVER_STORE_PATH", raising=False)
    monkeypatch.setenv("LANDWEAVER_STORAGE_DIR", str(storage_dir))

    assert _store_path() == storage_dir / "store.json"


def test_store_path_allows_explicit_override(monkeypatch, tmp_path):
    explicit_path = tmp_path / "custom" / "store.json"
    monkeypatch.setenv("LANDWEAVER_STORE_PATH", str(explicit_path))
    monkeypatch.setenv("LANDWEAVER_STORAGE_DIR", str(tmp_path / "ignored"))

    assert _store_path() == explicit_path
