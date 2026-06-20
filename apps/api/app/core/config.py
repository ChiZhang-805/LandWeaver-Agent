from __future__ import annotations

import os
import json
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "LandWeaver Agent API"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://landweaver:landweaver@localhost:5432/landweaver"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str | None = None
    openai_model_text: str = "gpt-5.5"
    openai_model_fast: str = "gpt-5.4-mini"
    storage_dir: Path = Path(__file__).resolve().parents[2] / "storage"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3010",
        "http://127.0.0.1:3010",
        "http://localhost:3011",
        "http://127.0.0.1:3011",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings(
        database_url=os.getenv("DATABASE_URL", Settings().database_url),
        redis_url=os.getenv("REDIS_URL", Settings().redis_url),
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model_text=os.getenv("OPENAI_MODEL_TEXT", Settings().openai_model_text),
        openai_model_fast=os.getenv("OPENAI_MODEL_FAST", Settings().openai_model_fast),
        storage_dir=Path(os.getenv("LANDWEAVER_STORAGE_DIR", Settings().storage_dir)),
        cors_origins=[
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", ",".join(Settings().cors_origins)).split(",")
            if origin.strip()
        ],
    )


def _openai_settings_path(settings: Settings | None = None) -> Path:
    current = settings or get_settings()
    return current.storage_dir / "openai_settings.json"


def _mask_key(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) <= 10:
        return f"{value[:2]}...{value[-2:]}"
    return f"{value[:7]}...{value[-4:]}"


def _read_openai_runtime_settings() -> dict:
    path = _openai_settings_path()
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def get_openai_runtime_settings() -> dict:
    settings = get_settings()
    runtime = _read_openai_runtime_settings()
    api_key = str(runtime.get("api_key") or settings.openai_api_key or "").strip() or None
    model_text = str(runtime.get("model_text") or settings.openai_model_text).strip()
    model_fast = str(runtime.get("model_fast") or settings.openai_model_fast).strip()
    source = "web" if runtime.get("api_key") else "env" if settings.openai_api_key else "mock"
    return {
        "api_key": api_key,
        "configured": bool(api_key),
        "source": source,
        "masked_key": _mask_key(api_key),
        "model_text": model_text,
        "model_fast": model_fast,
    }


def save_openai_runtime_settings(api_key: str | None, model_text: str | None, model_fast: str | None) -> dict:
    settings = get_settings()
    path = _openai_settings_path(settings)
    path.parent.mkdir(parents=True, exist_ok=True)
    current = _read_openai_runtime_settings()
    if api_key is not None:
        current["api_key"] = api_key.strip()
    if model_text is not None:
        current["model_text"] = model_text.strip() or settings.openai_model_text
    if model_fast is not None:
        current["model_fast"] = model_fast.strip() or settings.openai_model_fast
    path.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass
    return get_openai_runtime_settings()


def clear_openai_runtime_settings() -> dict:
    path = _openai_settings_path()
    if path.exists():
        path.unlink()
    return get_openai_runtime_settings()
