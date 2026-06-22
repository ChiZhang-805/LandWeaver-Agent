from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


class ProjectStatus(str, Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1)
    city: str = Field(default="未指定")


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    city: str | None = None
    status: ProjectStatus | None = None


class Project(BaseModel):
    id: str = Field(default_factory=lambda: new_id("project"))
    title: str
    city: str = "未指定"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: ProjectStatus = ProjectStatus.draft


class ParcelSource(str, Enum):
    manual = "manual"
    geojson = "geojson"
    dxf = "dxf"
    dxf_placeholder = "dxf_placeholder"


Coordinate = tuple[float, float]


class ParcelCreate(BaseModel):
    points: list[Coordinate] | None = None
    geojson: dict[str, Any] | None = None
    dxf_text: str | None = None
    north_angle_deg: float = 0
    source: ParcelSource = ParcelSource.manual

    @model_validator(mode="after")
    def require_geometry(self):
        if not self.points and not self.geojson and not self.dxf_text:
            raise ValueError("Either points, geojson, or dxf_text must be provided.")
        return self


class Parcel(BaseModel):
    id: str = Field(default_factory=lambda: new_id("parcel"))
    project_id: str
    unit: Literal["m"] = "m"
    boundary: list[Coordinate]
    north_angle_deg: float = 0
    area_m2: float
    source: ParcelSource = ParcelSource.manual


class PlanningBriefInput(BaseModel):
    user_text: str = Field(..., min_length=1)


class PlanningBrief(BaseModel):
    target_customer: str = "改善型家庭"
    product_positioning: str = "中高端住宅"
    unit_mix_targets: dict[str, float] = Field(default_factory=dict)
    risk_preference: Literal["low", "medium", "high"] = "medium"
    strategy_preference: Literal["revenue_first", "balanced", "low_risk"] = "balanced"
    notes: str = ""


class EconomicAssumptions(BaseModel):
    avg_selling_price_cny_per_m2: float = Field(gt=0)
    hard_cost_cny_per_m2: float = Field(gt=0)
    land_cost_cny: float = Field(ge=0)
    soft_cost_ratio: float = Field(default=0.12, ge=0)
    tax_ratio: float = Field(default=0.09, ge=0)
    marketing_ratio: float = Field(default=0.03, ge=0)


class ConstraintSet(BaseModel):
    far_max: float = Field(gt=0)
    building_density_max: float = Field(gt=0, le=1)
    green_ratio_min: float = Field(default=0.3, ge=0, le=1)
    height_limit_m: float = Field(gt=0)
    setbacks_m: dict[str, float] = Field(default_factory=lambda: {"north": 10, "south": 10, "east": 8, "west": 8})
    min_spacing_m: float = Field(default=18, ge=0)
    parking_ratio_per_unit: float = Field(default=1.1, ge=0)
    saleable_ratio: float = Field(default=0.82, gt=0, le=1)
    assumptions: EconomicAssumptions

    @field_validator("setbacks_m")
    @classmethod
    def validate_setbacks(cls, value: dict[str, float]) -> dict[str, float]:
        for direction in ("north", "south", "east", "west"):
            value.setdefault(direction, 0)
        if any(distance < 0 for distance in value.values()):
            raise ValueError("Setbacks must be non-negative.")
        return value


class PrototypeType(str, Enum):
    tower = "tower"
    slab = "slab"
    villa = "villa"
    podium = "podium"


class BuildingPrototypeCreate(BaseModel):
    type: PrototypeType
    footprint_width_m: float = Field(gt=0)
    footprint_depth_m: float = Field(gt=0)
    floors_min: int = Field(ge=1)
    floors_max: int = Field(ge=1)
    typical_floor_gfa_m2: float = Field(gt=0)
    units_per_floor: int = Field(ge=1)
    avg_unit_area_m2: float = Field(gt=0)
    height_per_floor_m: float = Field(default=3.0, gt=0)

    @field_validator("floors_max")
    @classmethod
    def floors_order(cls, value: int, info) -> int:
        floors_min = info.data.get("floors_min")
        if floors_min is not None and value < floors_min:
            raise ValueError("floors_max must be greater than or equal to floors_min.")
        return value


class BuildingPrototype(BuildingPrototypeCreate):
    id: str = Field(default_factory=lambda: new_id("prototype"))


class BuildingInstance(BaseModel):
    prototype_id: str
    prototype_type: str | None = None
    footprint: list[Coordinate]
    centroid: Coordinate
    rotation_deg: float
    floors: int
    height_m: float
    gfa_m2: float
    units: int
    violations: list[str] = Field(default_factory=list)


class ProfitSnapshot(BaseModel):
    total_gfa_m2: float
    saleable_area_m2: float
    units: int
    parking_spaces: int
    revenue_cny: float
    hard_cost_cny: float
    total_cost_cny: float
    gross_margin_cny: float
    gross_margin_ratio: float


class SiteOption(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(default_factory=lambda: new_id("option"))
    strategy: Literal["revenue_first", "balanced", "low_risk"]
    parcel_id: str
    buildings: list[BuildingInstance]
    metrics: dict[str, Any]
    violations: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    score: float
    seed: int = 0
    buildable_envelope: list[Coordinate] | None = None


class OptionDeriveRequest(BaseModel):
    name: str | None = None
    keep_indexes: list[int] | None = None
    remove_indexes: list[int] = Field(default_factory=list)
    locked_indexes: list[int] = Field(default_factory=list)


class ReportResponse(BaseModel):
    option_id: str
    download_path: str
    local_path: str


class JobStatus(BaseModel):
    job_id: str
    status: Literal["queued", "running", "finished", "failed"]
    stage: str = "queued"
    progress: int = 0
    result_ids: list[str] = Field(default_factory=list)
    error: str | None = None
    relax_suggestions: list[str] = Field(default_factory=list)


class DesignDiagnosticCheck(BaseModel):
    key: str
    label: str
    status: Literal["pass", "warn", "fail", "missing"]
    message: str
    action: str | None = None
    metric: float | None = None


class ProjectDiagnostics(BaseModel):
    readiness: Literal["ready", "blocked", "needs_attention"]
    score: int
    summary: str
    metrics: dict[str, float | int | str | None] = Field(default_factory=dict)
    checks: list[DesignDiagnosticCheck] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class WorkflowStep(BaseModel):
    key: str
    label: str
    status: Literal["done", "current", "available", "blocked"]
    artifact_count: int = Field(ge=0)
    blockers: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    automation_hint: str


class PortableServiceSpec(BaseModel):
    key: str
    label: str
    service_type: Literal["api", "worker", "cli", "export"]
    purpose: str
    inputs: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    status: Literal["ready", "planned", "blocked"] = "planned"


class ProjectCommandCenter(BaseModel):
    project_id: str
    readiness: Literal["ready", "blocked", "needs_attention"]
    score: int = Field(ge=0, le=100)
    current_focus: str
    summary: str
    workflow_steps: list[WorkflowStep] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    automation_plan: list[str] = Field(default_factory=list)
    llm_modules: list[PortableServiceSpec] = Field(default_factory=list)
    portable_services: list[PortableServiceSpec] = Field(default_factory=list)
    key_metrics: dict[str, float | int | str | None] = Field(default_factory=dict)


class OptionReviewItem(BaseModel):
    key: str
    label: str
    status: Literal["excellent", "good", "watch", "risk"]
    score: int
    message: str
    action: str | None = None


class OptionReview(BaseModel):
    option_id: str
    overall_score: int
    grade: Literal["A", "B", "C", "D"]
    summary: str
    metrics: dict[str, float | int | str | None] = Field(default_factory=dict)
    items: list[OptionReviewItem] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)


class InvestmentMemoMetric(BaseModel):
    key: str
    label: str
    value: float | int | str | None
    signal: Literal["positive", "neutral", "watch", "risk"]
    note: str


class InvestmentRiskRegisterItem(BaseModel):
    key: str
    risk: str
    severity: Literal["low", "medium", "high", "critical"]
    metric: str | None = None
    mitigation: str
    owner: Literal["investment", "design", "cost", "legal", "market", "data"]


class InvestmentMemo(BaseModel):
    option_id: str
    project_id: str
    generated_with: Literal["local_rules"] = "local_rules"
    recommendation: Literal["go", "conditional_go", "no_go"]
    confidence_score: int = Field(ge=0, le=100)
    executive_summary: str
    key_metrics: list[InvestmentMemoMetric] = Field(default_factory=list)
    value_drivers: list[str] = Field(default_factory=list)
    risk_register: list[InvestmentRiskRegisterItem] = Field(default_factory=list)
    sensitivity_summary: str
    committee_questions: list[str] = Field(default_factory=list)
    data_room_checklist: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)


class DueDiligenceGap(BaseModel):
    key: str
    label: str
    severity: Literal["low", "medium", "high", "critical"]
    reason: str
    evidence_needed: list[str] = Field(default_factory=list)
    owner: Literal["investment", "design", "cost", "legal", "market", "data"]


class DatasetQuerySpec(BaseModel):
    key: str
    label: str
    dataset_type: Literal["gis", "zoning", "market", "cost", "legal", "demographic", "mobility"]
    query_hint: str
    fields: list[str] = Field(default_factory=list)
    update_frequency: str
    license_note: str


class DueDiligencePack(BaseModel):
    option_id: str
    project_id: str
    generated_with: Literal["local_rules"] = "local_rules"
    executive_focus: str
    evidence_gaps: list[DueDiligenceGap] = Field(default_factory=list)
    dataset_queries: list[DatasetQuerySpec] = Field(default_factory=list)
    llm_assistants: list[PortableServiceSpec] = Field(default_factory=list)
    portable_services: list[PortableServiceSpec] = Field(default_factory=list)
    handoff_prompts: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)


class VisualDesignRequest(BaseModel):
    option_id: str | None = None
    style_preference: str = Field(default="现代高端、轻奢改善、温暖社区感")
    reference_notes: str = ""
    audience: Literal["internal_review", "investment_committee", "design_presentation"] = "design_presentation"


class VisualPaletteColor(BaseModel):
    label: str
    hex: str
    material: str
    usage: str


class VisualViewPrompt(BaseModel):
    title: str
    purpose: str
    prompt: str


class VisualDesignPackage(BaseModel):
    project_id: str
    option_id: str | None = None
    source: Literal["openai", "fallback"]
    design_title: str
    concept_statement: str
    style_keywords: list[str] = Field(default_factory=list)
    architectural_style: str
    landscape_strategy: str
    public_space_moves: list[str] = Field(default_factory=list)
    facade_guidelines: list[str] = Field(default_factory=list)
    material_palette: list[VisualPaletteColor] = Field(default_factory=list)
    rendering_prompts: list[VisualViewPrompt] = Field(default_factory=list)
    presentation_notes: list[str] = Field(default_factory=list)
    negative_prompt: str
    cautions: list[str] = Field(default_factory=list)


class ExportResponse(BaseModel):
    format: Literal["geojson", "dxf", "csv"]
    download_path: str
    local_path: str


class OpenAISettingsStatus(BaseModel):
    configured: bool
    source: Literal["browser", "env", "mock"]
    masked_key: str | None = None
    model_text: str
    model_fast: str
