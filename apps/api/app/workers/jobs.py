from __future__ import annotations

from app.db.memory import STORE
from app.schemas.domain import JobStatus, SiteOption
from engines.geometry import normalize_polygon
from engines.optimizer import generate_site_options


def generate_site_options_job(project_id: str, job_id: str) -> JobStatus:
    job = STORE.jobs[job_id]
    job.status = "running"
    job.stage = "validating_inputs"
    job.progress = 15
    STORE.persist()

    parcel_id = STORE.project_parcels.get(project_id)
    if not parcel_id:
        job.status = "failed"
        job.error = "Project has no parcel."
        STORE.persist()
        return job
    if project_id not in STORE.constraints:
        job.status = "failed"
        job.error = "Project has no constraint set."
        STORE.persist()
        return job
    if not STORE.prototypes.get(project_id):
        job.status = "failed"
        job.error = "Project has no building prototypes."
        STORE.persist()
        return job

    parcel = STORE.parcels[parcel_id]
    constraints = STORE.constraints[project_id]
    prototypes = STORE.prototypes[project_id]
    polygon = normalize_polygon(parcel.boundary)

    job.stage = "optimizing"
    job.progress = 45
    STORE.persist()
    result = generate_site_options(polygon, constraints, prototypes, parcel_id=parcel.id)
    if result.get("status") != "feasible":
        job.status = "failed"
        job.stage = "infeasible"
        job.progress = 100
        job.error = result.get("infeasible_reason", "No feasible option.")
        job.relax_suggestions = result.get("relax_suggestions", [])
        STORE.persist()
        return job

    job.stage = "persisting_options"
    job.progress = 80
    STORE.persist()
    result_ids: list[str] = []
    STORE.project_options[project_id].clear()
    for payload in result["options"]:
        payload = {key: value for key, value in payload.items() if key != "status"}
        option = SiteOption.model_validate(payload)
        STORE.options[option.id] = option
        STORE.project_options[project_id].append(option.id)
        result_ids.append(option.id)

    job.status = "finished"
    job.stage = "finished"
    job.progress = 100
    job.result_ids = result_ids
    STORE.persist()
    return job
