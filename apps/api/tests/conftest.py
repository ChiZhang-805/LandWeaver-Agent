from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "tests" / "fixtures"
STORE_PATH = ROOT / ".pytest_cache" / "test-store.json"
STORAGE_DIR = ROOT / ".pytest_cache" / "storage"
os.environ["LANDWEAVER_STORE_PATH"] = str(STORE_PATH)
os.environ["LANDWEAVER_STORAGE_DIR"] = str(STORAGE_DIR)

from app.db.memory import STORE  # noqa: E402


@pytest.fixture(autouse=True)
def reset_store():
    STORE.reset()
    STORE_PATH.unlink(missing_ok=True)
    shutil.rmtree(STORAGE_DIR, ignore_errors=True)
    yield
    STORE.reset()
    STORE_PATH.unlink(missing_ok=True)
    shutil.rmtree(STORAGE_DIR, ignore_errors=True)


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture
def rectangular_parcel() -> dict:
    return load_fixture("rectangular_parcel.json")


@pytest.fixture
def planning_constraints() -> dict:
    return load_fixture("planning_constraints.json")


@pytest.fixture
def tower_prototype() -> dict:
    return load_fixture("tower_prototype.json")


@pytest.fixture
def slab_prototype() -> dict:
    return load_fixture("slab_prototype.json")
