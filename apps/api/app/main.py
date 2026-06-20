from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.routes.projects import router as projects_router


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(projects_router)
export_dir = settings.storage_dir / "exports"
export_dir.mkdir(parents=True, exist_ok=True)
app.mount("/exports", StaticFiles(directory=export_dir), name="exports")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name}
