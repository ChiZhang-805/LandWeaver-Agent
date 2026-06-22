from __future__ import annotations

from collections.abc import AsyncGenerator
from copy import deepcopy
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query

from app.core.config import (
    get_openai_runtime_settings,
    get_settings,
    reset_request_openai_overrides,
    set_request_openai_overrides,
)
from app.db.memory import STORE
from app.schemas.domain import (
    BuildingPrototype,
    BuildingPrototypeCreate,
    ConstraintSet,
    DueDiligencePack,
    ExportResponse,
    InvestmentMemo,
    JobStatus,
    OpenAISettingsStatus,
    OptionDeriveRequest,
    OptionReview,
    Parcel,
    ParcelCreate,
    ParcelSource,
    PlanningBrief,
    PlanningBriefInput,
    Project,
    ProjectCommandCenter,
    ProjectCreate,
    ProjectDiagnostics,
    ProjectUpdate,
    ReportResponse,
    SiteOption,
    VisualDesignPackage,
    VisualDesignRequest,
    new_id,
)
from app.services.design_diagnostics import diagnose_project_design
from app.services.due_diligence_pack import build_due_diligence_pack
from app.services.investment_memo import build_investment_memo
from app.services.openai_service import explain_site_option, generate_visual_design_package, parse_planning_brief
from app.services.option_review import review_site_option
from app.services.project_workflow import build_project_command_center
from app.workers.jobs import generate_site_options_job
from engines.export import export_csv, export_dxf, export_geojson
from engines.geometry import GeometryError, compute_area_m2, density_area, normalize_polygon, polygon_to_points
from engines.importers import parse_dxf_polyline
from engines.profit import calculate_profit, calculate_sensitivity
from engines.report import render_option_report


async def _openai_request_context(
    x_openai_api_key: Annotated[str | None, Header(alias="X-OpenAI-API-Key")] = None,
    x_openai_model_text: Annotated[str | None, Header(alias="X-OpenAI-Model-Text")] = None,
    x_openai_model_fast: Annotated[str | None, Header(alias="X-OpenAI-Model-Fast")] = None,
) -> AsyncGenerator[None, None]:
    tokens = set_request_openai_overrides(x_openai_api_key, x_openai_model_text, x_openai_model_fast)
    try:
        yield
    finally:
        reset_request_openai_overrides(tokens)


router = APIRouter(prefix="/api", tags=["LandWeaver"], dependencies=[Depends(_openai_request_context)])


@router.get("/settings/openai", response_model=OpenAISettingsStatus)
def read_openai_settings() -> OpenAISettingsStatus:
    return OpenAISettingsStatus.model_validate(get_openai_runtime_settings())


def _project_or_404(project_id: str) -> Project:
    project = STORE.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


def _option_or_404(option_id: str):
    option = STORE.options.get(option_id)
    if not option:
        raise HTTPException(status_code=404, detail="Site option not found.")
    return option


def _project_id_for_option(option_id: str) -> str | None:
    return next((pid for pid, option_ids in STORE.project_options.items() if option_id in option_ids), None)


def _clear_project_options(project_id: str) -> None:
    option_ids = STORE.project_options.pop(project_id, [])
    for option_id in option_ids:
        STORE.options.pop(option_id, None)


def _project_aggregate(project_id: str) -> dict:
    project = _project_or_404(project_id)
    parcel_id = STORE.project_parcels.get(project_id)
    option_ids = STORE.project_options.get(project_id, [])
    return {
        "project": project,
        "parcel": STORE.parcels.get(parcel_id) if parcel_id else None,
        "brief": STORE.briefs.get(project_id),
        "constraints": STORE.constraints.get(project_id),
        "prototypes": STORE.prototypes.get(project_id, []),
        "options": [STORE.options[option_id] for option_id in option_ids if option_id in STORE.options],
    }


def _delete_project(project_id: str) -> None:
    STORE.projects.pop(project_id, None)
    parcel_id = STORE.project_parcels.pop(project_id, None)
    if parcel_id:
        STORE.parcels.pop(parcel_id, None)
    STORE.briefs.pop(project_id, None)
    STORE.constraints.pop(project_id, None)
    STORE.prototypes.pop(project_id, None)
    _clear_project_options(project_id)


def _ring_from_geojson_coordinates(coordinates: Any) -> list[tuple[float, float]]:
    if not coordinates:
        raise GeometryError("GeoJSON polygon has no coordinates.")
    exterior = coordinates[0]
    points: list[tuple[float, float]] = []
    for point in exterior:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            raise GeometryError("GeoJSON coordinates must contain x and y values.")
        points.append((float(point[0]), float(point[1])))
    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]
    return points


def _points_from_geojson(geojson: dict[str, Any]) -> list[tuple[float, float]]:
    geometry_type = geojson.get("type")
    if geometry_type == "FeatureCollection":
        features = geojson.get("features") or []
        polygons = [_points_from_geojson(feature) for feature in features if feature.get("geometry")]
        if not polygons:
            raise GeometryError("GeoJSON FeatureCollection contains no polygon features.")
        return max(polygons, key=lambda ring: normalize_polygon(ring).area)
    if geometry_type == "Feature":
        geometry = geojson.get("geometry")
        if not geometry:
            raise GeometryError("GeoJSON Feature contains no geometry.")
        return _points_from_geojson(geometry)
    if geometry_type == "Polygon":
        return _ring_from_geojson_coordinates(geojson.get("coordinates"))
    if geometry_type == "MultiPolygon":
        polygons = geojson.get("coordinates") or []
        rings = [_ring_from_geojson_coordinates(polygon) for polygon in polygons]
        if not rings:
            raise GeometryError("GeoJSON MultiPolygon contains no polygon coordinates.")
        return max(rings, key=lambda ring: normalize_polygon(ring).area)
    raise GeometryError("Only GeoJSON Polygon, MultiPolygon, Feature, and FeatureCollection inputs are supported.")


@router.post("/projects", response_model=Project)
def create_project(payload: ProjectCreate) -> Project:
    project = Project(title=payload.title, city=payload.city)
    STORE.projects[project.id] = project
    STORE.persist()
    return project


@router.get("/projects", response_model=list[Project])
def list_projects(include_archived: bool = Query(default=True)) -> list[Project]:
    projects = sorted(STORE.projects.values(), key=lambda item: item.created_at, reverse=True)
    if not include_archived:
        projects = [project for project in projects if project.status != "archived"]
    return projects


@router.patch("/projects/{project_id}", response_model=Project)
def update_project(project_id: str, payload: ProjectUpdate) -> Project:
    project = _project_or_404(project_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(project, key, value)
    STORE.persist()
    return project


@router.post("/projects/{project_id}/duplicate")
def duplicate_project(project_id: str) -> dict:
    project = _project_or_404(project_id)
    duplicate = Project(title=f"{project.title} Copy", city=project.city)
    STORE.projects[duplicate.id] = duplicate
    parcel_id = STORE.project_parcels.get(project_id)
    if parcel_id and parcel_id in STORE.parcels:
        old = STORE.parcels[parcel_id]
        parcel = Parcel(
            project_id=duplicate.id,
            boundary=deepcopy(old.boundary),
            north_angle_deg=old.north_angle_deg,
            area_m2=old.area_m2,
            source=old.source,
        )
        STORE.parcels[parcel.id] = parcel
        STORE.project_parcels[duplicate.id] = parcel.id
    if project_id in STORE.briefs:
        STORE.briefs[duplicate.id] = PlanningBrief.model_validate(STORE.briefs[project_id].model_dump())
    if project_id in STORE.constraints:
        STORE.constraints[duplicate.id] = ConstraintSet.model_validate(STORE.constraints[project_id].model_dump())
    STORE.prototypes[duplicate.id] = [
        BuildingPrototype(**prototype.model_dump(exclude={"id"})) for prototype in STORE.prototypes.get(project_id, [])
    ]
    STORE.persist()
    return _project_aggregate(duplicate.id)


@router.delete("/projects/{project_id}")
def delete_project(project_id: str) -> dict:
    _project_or_404(project_id)
    _delete_project(project_id)
    STORE.persist()
    return {"deleted": True, "project_id": project_id}


@router.get("/projects/{project_id}")
def get_project(project_id: str) -> dict:
    return _project_aggregate(project_id)


@router.get("/projects/{project_id}/diagnostics", response_model=ProjectDiagnostics)
def get_project_diagnostics(project_id: str) -> ProjectDiagnostics:
    _project_or_404(project_id)
    parcel_id = STORE.project_parcels.get(project_id)
    parcel = STORE.parcels.get(parcel_id) if parcel_id else None
    return diagnose_project_design(
        parcel=parcel,
        constraints=STORE.constraints.get(project_id),
        prototypes=STORE.prototypes.get(project_id, []),
        brief=STORE.briefs.get(project_id),
    )


@router.get("/projects/{project_id}/command-center", response_model=ProjectCommandCenter)
def get_project_command_center(project_id: str) -> ProjectCommandCenter:
    project = _project_or_404(project_id)
    parcel_id = STORE.project_parcels.get(project_id)
    parcel = STORE.parcels.get(parcel_id) if parcel_id else None
    brief = STORE.briefs.get(project_id)
    constraints = STORE.constraints.get(project_id)
    prototypes = STORE.prototypes.get(project_id, [])
    options = [STORE.options[option_id] for option_id in STORE.project_options.get(project_id, []) if option_id in STORE.options]
    diagnostics = diagnose_project_design(parcel=parcel, constraints=constraints, prototypes=prototypes, brief=brief)
    return build_project_command_center(
        project=project,
        parcel=parcel,
        brief=brief,
        constraints=constraints,
        prototypes_count=len(prototypes),
        options=options,
        diagnostics=diagnostics,
    )


@router.post("/projects/{project_id}/visual-design", response_model=VisualDesignPackage)
def create_visual_design(project_id: str, payload: VisualDesignRequest) -> VisualDesignPackage:
    project = _project_or_404(project_id)
    option: SiteOption | None = None
    option_id = payload.option_id
    option_ids = STORE.project_options.get(project_id, [])
    if option_id:
        if option_id not in option_ids:
            raise HTTPException(status_code=404, detail="Option does not belong to this project.")
        option = _option_or_404(option_id)
    elif option_ids:
        option_id = option_ids[0]
        option = _option_or_404(option_id)

    constraints = STORE.constraints.get(project_id)
    review = review_site_option(option, constraints, STORE.briefs.get(project_id)) if option and constraints else None
    context = {
        "project_id": project_id,
        "option_id": option.id if option else None,
        "project": project.model_dump(mode="json"),
        "brief": STORE.briefs.get(project_id).model_dump(mode="json") if STORE.briefs.get(project_id) else None,
        "constraints": constraints.model_dump(mode="json") if constraints else None,
        "option": option.model_dump(mode="json") if option else None,
        "review": review.model_dump(mode="json") if review else None,
    }
    return generate_visual_design_package(context, payload)


@router.post("/projects/{project_id}/parcels", response_model=Parcel)
def create_parcel(project_id: str, payload: ParcelCreate) -> Parcel:
    _project_or_404(project_id)
    points = payload.points
    source = payload.source
    if payload.geojson:
        points = _points_from_geojson(payload.geojson)
        source = ParcelSource.geojson
    if payload.dxf_text:
        try:
            points = parse_dxf_polyline(payload.dxf_text)
            source = ParcelSource.dxf
        except (GeometryError, ValueError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        polygon = normalize_polygon(points or [])
    except GeometryError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    parcel = Parcel(
        project_id=project_id,
        boundary=polygon_to_points(polygon),
        north_angle_deg=payload.north_angle_deg,
        area_m2=compute_area_m2(polygon),
        source=source,
    )
    old_parcel_id = STORE.project_parcels.get(project_id)
    if old_parcel_id and old_parcel_id != parcel.id:
        STORE.parcels.pop(old_parcel_id, None)
    _clear_project_options(project_id)
    STORE.parcels[parcel.id] = parcel
    STORE.project_parcels[project_id] = parcel.id
    STORE.persist()
    return parcel


@router.post("/projects/{project_id}/brief", response_model=PlanningBrief)
def create_brief(project_id: str, payload: PlanningBriefInput) -> PlanningBrief:
    _project_or_404(project_id)
    brief = parse_planning_brief(payload.user_text)
    _clear_project_options(project_id)
    STORE.briefs[project_id] = brief
    STORE.persist()
    return brief


@router.post("/projects/{project_id}/constraints", response_model=ConstraintSet)
def create_constraints(project_id: str, payload: ConstraintSet) -> ConstraintSet:
    _project_or_404(project_id)
    _clear_project_options(project_id)
    STORE.constraints[project_id] = payload
    STORE.persist()
    return payload


@router.post("/projects/{project_id}/prototypes", response_model=BuildingPrototype)
def create_prototype(project_id: str, payload: BuildingPrototypeCreate) -> BuildingPrototype:
    _project_or_404(project_id)
    prototype = BuildingPrototype(**payload.model_dump())
    _clear_project_options(project_id)
    STORE.prototypes[project_id].append(prototype)
    STORE.persist()
    return prototype


@router.put("/projects/{project_id}/prototypes/{prototype_id}", response_model=BuildingPrototype)
def update_prototype(project_id: str, prototype_id: str, payload: BuildingPrototypeCreate) -> BuildingPrototype:
    _project_or_404(project_id)
    prototypes = STORE.prototypes.get(project_id, [])
    for index, prototype in enumerate(prototypes):
        if prototype.id == prototype_id:
            updated = BuildingPrototype(id=prototype_id, **payload.model_dump())
            _clear_project_options(project_id)
            prototypes[index] = updated
            STORE.persist()
            return updated
    raise HTTPException(status_code=404, detail="Building prototype not found.")


@router.delete("/projects/{project_id}/prototypes/{prototype_id}")
def delete_prototype(project_id: str, prototype_id: str) -> dict:
    _project_or_404(project_id)
    prototypes = STORE.prototypes.get(project_id, [])
    remaining = [prototype for prototype in prototypes if prototype.id != prototype_id]
    if len(remaining) == len(prototypes):
        raise HTTPException(status_code=404, detail="Building prototype not found.")
    _clear_project_options(project_id)
    STORE.prototypes[project_id] = remaining
    STORE.persist()
    return {"deleted": True, "prototype_id": prototype_id}


@router.post("/projects/{project_id}/generate-site-options", response_model=JobStatus)
def generate_options(
    project_id: str,
    background_tasks: BackgroundTasks,
    run_sync: bool = Query(default=False),
) -> JobStatus:
    _project_or_404(project_id)
    job = JobStatus(job_id=new_id("job"), status="queued")
    STORE.jobs[job.job_id] = job
    STORE.persist()
    if run_sync:
        return generate_site_options_job(project_id, job.job_id)
    background_tasks.add_task(generate_site_options_job, project_id, job.job_id)
    return job


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str) -> JobStatus:
    job = STORE.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.get("/projects/{project_id}/options")
def list_options(project_id: str) -> list:
    _project_or_404(project_id)
    return [STORE.options[option_id] for option_id in STORE.project_options.get(project_id, []) if option_id in STORE.options]


@router.get("/options/{option_id}")
def get_option(option_id: str):
    return _option_or_404(option_id)


@router.get("/options/{option_id}/review", response_model=OptionReview)
def review_option(option_id: str) -> OptionReview:
    option = _option_or_404(option_id)
    project_id = _project_id_for_option(option_id)
    if not project_id:
        raise HTTPException(status_code=404, detail="Project for option not found.")
    constraints = STORE.constraints.get(project_id)
    if not constraints:
        raise HTTPException(status_code=404, detail="Constraint set for option not found.")
    return review_site_option(option, constraints, STORE.briefs.get(project_id))


@router.post("/options/{option_id}/investment-memo", response_model=InvestmentMemo)
def investment_memo(option_id: str) -> InvestmentMemo:
    option = _option_or_404(option_id)
    project_id = _project_id_for_option(option_id)
    if not project_id:
        raise HTTPException(status_code=404, detail="Project for option not found.")
    project = _project_or_404(project_id)
    constraints = STORE.constraints.get(project_id)
    if not constraints:
        raise HTTPException(status_code=404, detail="Constraint set for option not found.")
    parcel_id = STORE.project_parcels.get(project_id)
    parcel = STORE.parcels.get(parcel_id) if parcel_id else None
    review = review_site_option(option, constraints, STORE.briefs.get(project_id))
    sensitivity_rows = calculate_sensitivity(option.model_dump(mode="json")["buildings"], constraints)
    return build_investment_memo(
        project=project,
        project_id=project_id,
        parcel=parcel,
        constraints=constraints,
        option=option,
        review=review,
        sensitivity=sensitivity_rows,
        brief=STORE.briefs.get(project_id),
    )


@router.post("/options/{option_id}/due-diligence", response_model=DueDiligencePack)
def due_diligence(option_id: str) -> DueDiligencePack:
    option = _option_or_404(option_id)
    project_id = _project_id_for_option(option_id)
    if not project_id:
        raise HTTPException(status_code=404, detail="Project for option not found.")
    project = _project_or_404(project_id)
    constraints = STORE.constraints.get(project_id)
    if not constraints:
        raise HTTPException(status_code=404, detail="Constraint set for option not found.")
    parcel_id = STORE.project_parcels.get(project_id)
    parcel = STORE.parcels.get(parcel_id) if parcel_id else None
    brief = STORE.briefs.get(project_id)
    review = review_site_option(option, constraints, brief)
    sensitivity_rows = calculate_sensitivity(option.model_dump(mode="json")["buildings"], constraints)
    memo = build_investment_memo(
        project=project,
        project_id=project_id,
        parcel=parcel,
        constraints=constraints,
        option=option,
        review=review,
        sensitivity=sensitivity_rows,
        brief=brief,
    )
    return build_due_diligence_pack(
        project=project,
        project_id=project_id,
        parcel=parcel,
        constraints=constraints,
        option=option,
        review=review,
        memo=memo,
        brief=brief,
    )


@router.post("/options/{option_id}/explain")
def explain_option(option_id: str) -> dict:
    option = _option_or_404(option_id)
    text = explain_site_option(option.metrics, option.violations, option.risk_flags)
    return {"option_id": option.id, "explanation": text}


def _evaluate_buildings(project_id: str, base_option: SiteOption, buildings: list[dict], name: str | None) -> SiteOption:
    parcel_id = STORE.project_parcels.get(project_id)
    if not parcel_id:
        raise HTTPException(status_code=404, detail="Parcel for option not found.")
    if project_id not in STORE.constraints:
        raise HTTPException(status_code=404, detail="Constraint set for option not found.")
    parcel_polygon = normalize_polygon(STORE.parcels[parcel_id].boundary)
    constraints = STORE.constraints[project_id].model_dump()
    footprint_polygons = [normalize_polygon(building["footprint"]) for building in buildings]
    profit = calculate_profit(buildings, constraints)
    footprint_area = density_area(footprint_polygons)
    parcel_area_m2 = float(parcel_polygon.area)
    far = profit["total_gfa_m2"] / parcel_area_m2 if parcel_area_m2 else 0
    density = footprint_area / parcel_area_m2 if parcel_area_m2 else 0
    metrics = {
        **profit,
        "parcel_area_m2": round(parcel_area_m2, 4),
        "footprint_area_m2": round(footprint_area, 4),
        "far": round(far, 6),
        "far_utilization": round(far / float(constraints["far_max"]), 6),
        "building_density": round(density, 6),
        "green_ratio_estimate": round(max(0.0, 1 - density), 6),
        "building_count": len(buildings),
        "max_height_m": round(max((float(building["height_m"]) for building in buildings), default=0), 4),
        "avg_unit_area_estimate_m2": round(profit["saleable_area_m2"] / profit["units"], 4) if profit["units"] else 0,
    }
    violations: list[str] = []
    if metrics["far"] > float(constraints["far_max"]) + 1e-6:
        violations.append("FAR exceeds input maximum.")
    if metrics["building_density"] > float(constraints["building_density_max"]) + 1e-6:
        violations.append("Building density exceeds input maximum.")
    if metrics["green_ratio_estimate"] < float(constraints["green_ratio_min"]) - 1e-6:
        violations.append("Estimated green ratio is below input minimum.")
    risk_flags: list[str] = []
    if metrics["far_utilization"] < 0.75:
        risk_flags.append("FAR utilization below 75%; consider smaller spacing or higher floors.")
    if metrics["gross_margin_ratio"] < 0.12:
        risk_flags.append("Gross margin ratio is below 12% under current assumptions.")
    if metrics["max_height_m"] > float(constraints["height_limit_m"]) * 0.95:
        risk_flags.append("Max building height is close to the height limit.")
    option = SiteOption(
        strategy=base_option.strategy,
        parcel_id=base_option.parcel_id,
        buildings=buildings,
        metrics=metrics,
        violations=violations,
        risk_flags=risk_flags,
        score=round(base_option.score - len(base_option.buildings) + len(buildings) - len(violations) * 10, 4),
        seed=base_option.seed,
        buildable_envelope=base_option.buildable_envelope,
        parent_option_id=base_option.id,
        edit_name=name or "manual derivative",
    )
    STORE.options[option.id] = option
    STORE.project_options[project_id].append(option.id)
    STORE.persist()
    return option


@router.post("/options/{option_id}/derive", response_model=SiteOption)
def derive_option(option_id: str, payload: OptionDeriveRequest) -> SiteOption:
    option = _option_or_404(option_id)
    project_id = _project_id_for_option(option_id)
    if not project_id:
        raise HTTPException(status_code=404, detail="Project for option not found.")
    indexes = payload.keep_indexes
    if indexes is None:
        removed = set(payload.remove_indexes)
        indexes = [index for index in range(len(option.buildings)) if index not in removed]
    seen_indexes: set[int] = set()
    valid_indexes: list[int] = []
    for index in indexes:
        if 0 <= index < len(option.buildings) and index not in seen_indexes:
            seen_indexes.add(index)
            valid_indexes.append(index)
    if not valid_indexes:
        raise HTTPException(status_code=422, detail="Derived option must keep at least one building.")
    buildings = [option.buildings[index].model_dump(mode="json") for index in valid_indexes]
    return _evaluate_buildings(project_id, option, buildings, payload.name)


@router.get("/options/{option_id}/sensitivity")
def sensitivity(option_id: str) -> dict:
    option = _option_or_404(option_id)
    project_id = _project_id_for_option(option_id)
    if not project_id or project_id not in STORE.constraints:
        raise HTTPException(status_code=404, detail="Constraint set for option not found.")
    return {
        "option_id": option.id,
        "scenarios": calculate_sensitivity(option.model_dump(mode="json")["buildings"], STORE.constraints[project_id]),
    }


@router.post("/options/{option_id}/report", response_model=ReportResponse)
def option_report(option_id: str) -> ReportResponse:
    option = _option_or_404(option_id)
    project_id = _project_id_for_option(option_id)
    if not project_id:
        raise HTTPException(status_code=404, detail="Project for option not found.")
    project = _project_or_404(project_id)
    parcel_id = STORE.project_parcels.get(project_id)
    parcel = STORE.parcels.get(parcel_id) if parcel_id else None
    if project_id not in STORE.constraints:
        raise HTTPException(status_code=404, detail="Constraint set for option not found.")
    sensitivity_rows = calculate_sensitivity(option.model_dump(mode="json")["buildings"], STORE.constraints[project_id])
    review = review_site_option(option, STORE.constraints[project_id], STORE.briefs.get(project_id))
    memo = build_investment_memo(
        project=project,
        project_id=project_id,
        parcel=parcel,
        constraints=STORE.constraints[project_id],
        option=option,
        review=review,
        sensitivity=sensitivity_rows,
        brief=STORE.briefs.get(project_id),
    )
    diligence = build_due_diligence_pack(
        project=project,
        project_id=project_id,
        parcel=parcel,
        constraints=STORE.constraints[project_id],
        option=option,
        review=review,
        memo=memo,
        brief=STORE.briefs.get(project_id),
    )
    explanation = explain_site_option(option.metrics, option.violations, option.risk_flags)
    html = render_option_report(
        project.model_dump(mode="json"),
        parcel.model_dump(mode="json") if parcel else None,
        option.model_dump(mode="json"),
        sensitivity_rows,
        explanation,
        memo.model_dump(mode="json"),
        diligence.model_dump(mode="json"),
    )
    export_dir = get_settings().storage_dir / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    path = export_dir / f"{option.id}.report.html"
    path.write_text(html, encoding="utf-8")
    return ReportResponse(option_id=option.id, download_path=f"/exports/{path.name}", local_path=str(path))


@router.post("/options/{option_id}/export", response_model=ExportResponse)
def export_option(option_id: str, format: str = Query(pattern="^(geojson|dxf|csv)$")) -> ExportResponse:
    option = _option_or_404(option_id)
    project_id = _project_id_for_option(option_id)
    if not project_id:
        raise HTTPException(status_code=404, detail="Project for option not found.")
    parcel_id = STORE.project_parcels.get(project_id)
    if not parcel_id:
        raise HTTPException(status_code=404, detail="Parcel for option not found.")
    parcel = STORE.parcels[parcel_id]
    parcel_polygon = normalize_polygon(parcel.boundary)
    settings = get_settings()
    export_dir = settings.storage_dir / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    suffix = "geojson" if format == "geojson" else format
    path = export_dir / f"{option.id}.{suffix}"
    option_payload = option.model_dump(mode="json")
    if format == "geojson":
        output = export_geojson(parcel_polygon, option_payload, path)
    elif format == "dxf":
        output = export_dxf(parcel_polygon, option_payload, path)
    else:
        output = export_csv(option_payload, path)
    return ExportResponse(format=format, download_path=f"/exports/{Path(output).name}", local_path=str(output))
