from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
import json
import os
from pathlib import Path
from threading import RLock
from typing import Any

from app.schemas.domain import BuildingPrototype, ConstraintSet, JobStatus, Parcel, PlanningBrief, Project, SiteOption


DEFAULT_STORE_PATH = Path(__file__).resolve().parents[2] / "storage" / "store.json"


def _store_path() -> Path:
    return Path(os.getenv("LANDWEAVER_STORE_PATH", DEFAULT_STORE_PATH))


@dataclass
class MemoryStore:
    projects: dict[str, Project] = field(default_factory=dict)
    parcels: dict[str, Parcel] = field(default_factory=dict)
    project_parcels: dict[str, str] = field(default_factory=dict)
    briefs: dict[str, PlanningBrief] = field(default_factory=dict)
    constraints: dict[str, ConstraintSet] = field(default_factory=dict)
    prototypes: dict[str, list[BuildingPrototype]] = field(default_factory=lambda: defaultdict(list))
    jobs: dict[str, JobStatus] = field(default_factory=dict)
    options: dict[str, SiteOption] = field(default_factory=dict)
    project_options: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    lock: Any = field(default_factory=RLock, repr=False)

    def reset(self) -> None:
        with self.lock:
            self.projects.clear()
            self.parcels.clear()
            self.project_parcels.clear()
            self.briefs.clear()
            self.constraints.clear()
            self.prototypes.clear()
            self.jobs.clear()
            self.options.clear()
            self.project_options.clear()

    def persist(self) -> None:
        with self.lock:
            path = _store_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "projects": {key: value.model_dump(mode="json") for key, value in self.projects.items()},
                "parcels": {key: value.model_dump(mode="json") for key, value in self.parcels.items()},
                "project_parcels": dict(self.project_parcels),
                "briefs": {key: value.model_dump(mode="json") for key, value in self.briefs.items()},
                "constraints": {key: value.model_dump(mode="json") for key, value in self.constraints.items()},
                "prototypes": {
                    key: [prototype.model_dump(mode="json") for prototype in prototypes]
                    for key, prototypes in self.prototypes.items()
                },
                "jobs": {key: value.model_dump(mode="json") for key, value in self.jobs.items()},
                "options": {key: value.model_dump(mode="json") for key, value in self.options.items()},
                "project_options": dict(self.project_options),
            }
            temp_path = path.with_name(f"{path.name}.tmp")
            temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            temp_path.replace(path)

    def load(self) -> None:
        with self.lock:
            path = _store_path()
            if not path.exists():
                return
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                projects = {key: Project.model_validate(value) for key, value in payload.get("projects", {}).items()}
                parcels = {key: Parcel.model_validate(value) for key, value in payload.get("parcels", {}).items()}
                project_parcels = dict(payload.get("project_parcels", {}))
                briefs = {key: PlanningBrief.model_validate(value) for key, value in payload.get("briefs", {}).items()}
                constraints = {
                    key: ConstraintSet.model_validate(value) for key, value in payload.get("constraints", {}).items()
                }
                prototypes = defaultdict(
                    list,
                    {
                        key: [BuildingPrototype.model_validate(item) for item in value]
                        for key, value in payload.get("prototypes", {}).items()
                    },
                )
                jobs = {key: JobStatus.model_validate(value) for key, value in payload.get("jobs", {}).items()}
                options = {key: SiteOption.model_validate(value) for key, value in payload.get("options", {}).items()}
                project_options = defaultdict(list, {key: list(value) for key, value in payload.get("project_options", {}).items()})
            except (OSError, json.JSONDecodeError, TypeError, ValueError):
                return
            self.projects = projects
            self.parcels = parcels
            self.project_parcels = project_parcels
            self.briefs = briefs
            self.constraints = constraints
            self.prototypes = prototypes
            self.jobs = jobs
            self.options = options
            self.project_options = project_options


STORE = MemoryStore()
STORE.load()
