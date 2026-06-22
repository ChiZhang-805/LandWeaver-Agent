from __future__ import annotations

import os
from contextvars import ContextVar, Token
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel


_request_openai_api_key: ContextVar[str | None] = ContextVar("request_openai_api_key", default=None)
_request_openai_model_text: ContextVar[str | None] = ContextVar("request_openai_model_text", default=None)
_request_openai_model_fast: ContextVar[str | None] = ContextVar("request_openai_model_fast", default=None)


def set_request_openai_overrides(
    api_key: str | None,
    model_text: str | None,
    model_fast: str | None,
) -> tuple[Token[str | None], Token[str | None], Token[str | None]]:
    return (
        _request_openai_api_key.set(api_key.strip() if api_key and api_key.strip() else None),
        _request_openai_model_text.set(model_text.strip() if model_text and model_text.strip() else None),
        _request_openai_model_fast.set(model_fast.strip() if model_fast and model_fast.strip() else None),
    )


def reset_request_openai_overrides(tokens: tuple[Token[str | None], Token[str | None], Token[str | None]]) -> None:
    _request_openai_api_key.reset(tokens[0])
    _request_openai_model_text.reset(tokens[1])
    _request_openai_model_fast.reset(tokens[2])


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


def _mask_key(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) <= 10:
        return f"{value[:2]}...{value[-2:]}"
    return f"{value[:7]}...{value[-4:]}"


def get_openai_runtime_settings() -> dict:
    settings = get_settings()
    request_key = _request_openai_api_key.get()
    request_model = bool(_request_openai_model_text.get() or _request_openai_model_fast.get())
    api_key = str(request_key or settings.openai_api_key or "").strip() or None
    model_text = str(_request_openai_model_text.get() or settings.openai_model_text).strip()
    model_fast = str(_request_openai_model_fast.get() or settings.openai_model_fast).strip()
    source = "browser" if request_key or request_model else "env" if settings.openai_api_key else "mock"
    return {
        "api_key": api_key,
        "configured": bool(api_key),
        "source": source,
        "masked_key": _mask_key(api_key),
        "model_text": model_text,
        "model_fast": model_fast,
    }
