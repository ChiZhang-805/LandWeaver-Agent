export type Coordinate = [number, number];

export type Project = {
  id: string;
  title: string;
  city: string;
  created_at: string;
  status: string;
};

export type Parcel = {
  id: string;
  project_id: string;
  unit: "m";
  boundary: Coordinate[];
  north_angle_deg: number;
  area_m2: number;
  source: "manual" | "geojson" | "dxf" | "dxf_placeholder";
};

export type EconomicAssumptions = {
  avg_selling_price_cny_per_m2: number;
  hard_cost_cny_per_m2: number;
  land_cost_cny: number;
  soft_cost_ratio: number;
  tax_ratio: number;
  marketing_ratio: number;
};

export type ConstraintSet = {
  far_max: number;
  building_density_max: number;
  green_ratio_min: number;
  height_limit_m: number;
  setbacks_m: Record<"north" | "south" | "east" | "west", number>;
  min_spacing_m: number;
  parking_ratio_per_unit: number;
  saleable_ratio: number;
  assumptions: EconomicAssumptions;
};

export type PlanningBrief = {
  target_customer: string;
  product_positioning: string;
  unit_mix_targets: Record<string, number>;
  risk_preference: "low" | "medium" | "high";
  strategy_preference: "revenue_first" | "balanced" | "low_risk";
  notes: string;
};

export type BuildingPrototype = {
  id: string;
  type: "tower" | "slab" | "villa" | "podium";
  footprint_width_m: number;
  footprint_depth_m: number;
  floors_min: number;
  floors_max: number;
  typical_floor_gfa_m2: number;
  units_per_floor: number;
  avg_unit_area_m2: number;
  height_per_floor_m: number;
};

export type BuildingInstance = {
  prototype_id: string;
  prototype_type?: string | null;
  footprint: Coordinate[];
  centroid: Coordinate;
  rotation_deg: number;
  floors: number;
  height_m: number;
  gfa_m2: number;
  units: number;
  violations: string[];
};

export type SiteOption = {
  id: string;
  strategy: "revenue_first" | "balanced" | "low_risk";
  parcel_id: string;
  buildings: BuildingInstance[];
  metrics: Record<string, unknown>;
  violations: string[];
  risk_flags: string[];
  score: number;
  seed: number;
  buildable_envelope?: Coordinate[];
  parent_option_id?: string;
  edit_name?: string;
};

export type JobStatus = {
  job_id: string;
  status: "queued" | "running" | "finished" | "failed";
  stage: string;
  progress: number;
  result_ids: string[];
  error?: string | null;
  relax_suggestions: string[];
};

export type DesignDiagnosticCheck = {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail" | "missing";
  message: string;
  action?: string | null;
  metric?: number | null;
};

export type ProjectDiagnostics = {
  readiness: "ready" | "blocked" | "needs_attention";
  score: number;
  summary: string;
  metrics: Record<string, number | string | null>;
  checks: DesignDiagnosticCheck[];
  suggestions: string[];
};

export type WorkflowStep = {
  key: string;
  label: string;
  status: "done" | "current" | "available" | "blocked";
  artifact_count: number;
  blockers: string[];
  next_actions: string[];
  automation_hint: string;
};

export type PortableServiceSpec = {
  key: string;
  label: string;
  service_type: "api" | "worker" | "cli" | "export";
  purpose: string;
  inputs: string[];
  outputs: string[];
  status: "ready" | "planned" | "blocked";
};

export type ProjectCommandCenter = {
  project_id: string;
  readiness: "ready" | "blocked" | "needs_attention";
  score: number;
  current_focus: string;
  summary: string;
  workflow_steps: WorkflowStep[];
  blockers: string[];
  automation_plan: string[];
  llm_modules: PortableServiceSpec[];
  portable_services: PortableServiceSpec[];
  key_metrics: Record<string, number | string | null>;
};

export type OptionReviewItem = {
  key: string;
  label: string;
  status: "excellent" | "good" | "watch" | "risk";
  score: number;
  message: string;
  action?: string | null;
};

export type OptionReview = {
  option_id: string;
  overall_score: number;
  grade: "A" | "B" | "C" | "D";
  summary: string;
  metrics: Record<string, number | string | null>;
  items: OptionReviewItem[];
  strengths: string[];
  weaknesses: string[];
  next_actions: string[];
};

export type InvestmentMemoMetric = {
  key: string;
  label: string;
  value: number | string | null;
  signal: "positive" | "neutral" | "watch" | "risk";
  note: string;
};

export type InvestmentRiskRegisterItem = {
  key: string;
  risk: string;
  severity: "low" | "medium" | "high" | "critical";
  metric?: string | null;
  mitigation: string;
  owner: "investment" | "design" | "cost" | "legal" | "market" | "data";
};

export type InvestmentMemo = {
  option_id: string;
  project_id: string;
  generated_with: "local_rules";
  recommendation: "go" | "conditional_go" | "no_go";
  confidence_score: number;
  executive_summary: string;
  key_metrics: InvestmentMemoMetric[];
  value_drivers: string[];
  risk_register: InvestmentRiskRegisterItem[];
  sensitivity_summary: string;
  committee_questions: string[];
  data_room_checklist: string[];
  next_actions: string[];
  caveats: string[];
};

export type DueDiligenceGap = {
  key: string;
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  evidence_needed: string[];
  owner: "investment" | "design" | "cost" | "legal" | "market" | "data";
};

export type DatasetQuerySpec = {
  key: string;
  label: string;
  dataset_type: "gis" | "zoning" | "market" | "cost" | "legal" | "demographic" | "mobility";
  query_hint: string;
  fields: string[];
  update_frequency: string;
  license_note: string;
};

export type DataLibraryType = "parcel" | "zoning" | "market" | "cost" | "prototype" | "mobility" | "context";

export type DataLibrarySource = {
  id: string;
  name: string;
  url: string;
  dataset_type: DataLibraryType;
  license: string;
  commercial_use: "allowed" | "restricted" | "unknown";
  recommended_use: string;
  notes: string[];
};

export type DataLibraryItem = {
  id: string;
  title: string;
  dataset_type: DataLibraryType;
  city: string;
  district?: string | null;
  source_dataset_id: string;
  source_dataset_name: string;
  source_url: string;
  license: string;
  commercial_use: "allowed" | "restricted" | "unknown";
  summary: string;
  tags: string[];
  metrics: Record<string, number | string | null>;
  preview_image_url?: string | null;
  preview_kind: "map" | "chart" | "prototype" | "document";
  match_score: number;
};

export type DataLibrarySearchResponse = {
  sources: DataLibrarySource[];
  items: DataLibraryItem[];
};

export type DueDiligencePack = {
  option_id: string;
  project_id: string;
  generated_with: "local_rules";
  executive_focus: string;
  evidence_gaps: DueDiligenceGap[];
  dataset_queries: DatasetQuerySpec[];
  llm_assistants: PortableServiceSpec[];
  portable_services: PortableServiceSpec[];
  handoff_prompts: string[];
  next_actions: string[];
  caveats: string[];
};

export type VisualDesignRequest = {
  option_id?: string | null;
  style_preference: string;
  reference_notes?: string;
  audience: "internal_review" | "investment_committee" | "design_presentation";
};

export type VisualPaletteColor = {
  label: string;
  hex: string;
  material: string;
  usage: string;
};

export type VisualViewPrompt = {
  title: string;
  purpose: string;
  prompt: string;
};

export type VisualDesignPackage = {
  project_id: string;
  option_id?: string | null;
  source: "openai" | "fallback";
  design_title: string;
  concept_statement: string;
  style_keywords: string[];
  architectural_style: string;
  landscape_strategy: string;
  public_space_moves: string[];
  facade_guidelines: string[];
  material_palette: VisualPaletteColor[];
  rendering_prompts: VisualViewPrompt[];
  presentation_notes: string[];
  negative_prompt: string;
  cautions: string[];
};

export type SensitivityScenario = {
  variable: "avg_selling_price_cny_per_m2" | "hard_cost_cny_per_m2";
  delta: number;
  gross_margin_ratio: number;
  gross_margin_cny: number;
};

export type ProjectAggregate = {
  project: Project;
  parcel: Parcel | null;
  brief: PlanningBrief | null;
  constraints: ConstraintSet | null;
  prototypes: BuildingPrototype[];
  options: SiteOption[];
};

export type OpenAISettingsStatus = {
  configured: boolean;
  source: "browser" | "env" | "mock";
  masked_key: string | null;
  model_text: string;
  model_fast: string;
};
