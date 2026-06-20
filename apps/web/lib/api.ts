import type {
  BuildingPrototype,
  ConstraintSet,
  Coordinate,
  DueDiligencePack,
  InvestmentMemo,
  ProjectCommandCenter,
  ProjectDiagnostics,
  JobStatus,
  OptionReview,
  Parcel,
  PlanningBrief,
  Project,
  ProjectAggregate,
  OpenAISettingsStatus,
  SensitivityScenario,
  SiteOption,
  VisualDesignPackage,
  VisualDesignRequest
} from "./types";

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export const API_BASE = configuredApiBase ? configuredApiBase.replace(/\/$/, "") : "";

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {})
      },
      cache: "no-store"
    });
  } catch {
    throw new Error("无法连接后端 API，请确认 LandWeaver API 服务已启动。");
  }
  if (!response.ok) {
    const detail = await response.text();
    let message = detail || `Request failed: ${response.status}`;
    try {
      const parsed = JSON.parse(detail) as { detail?: unknown };
      if (typeof parsed.detail === "string") {
        message = parsed.detail;
      } else if (Array.isArray(parsed.detail)) {
        message = parsed.detail
          .map((item) => {
            if (item && typeof item === "object" && "msg" in item) {
              return String((item as { msg: unknown }).msg);
            }
            return String(item);
          })
          .join("; ");
      }
    } catch {
      // Keep the raw response body when it is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function createProject(payload: { title: string; city: string }) {
  return request<Project>("/api/projects", { method: "POST", body: JSON.stringify(payload) });
}

export function listProjects(includeArchived = true) {
  return request<Project[]>(`/api/projects?include_archived=${includeArchived ? "true" : "false"}`);
}

export function updateProject(projectId: string, payload: Partial<Pick<Project, "title" | "city" | "status">>) {
  return request<Project>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function duplicateProject(projectId: string) {
  return request<ProjectAggregate>(`/api/projects/${projectId}/duplicate`, { method: "POST" });
}

export function deleteProject(projectId: string) {
  return request<{ deleted: boolean; project_id: string }>(`/api/projects/${projectId}`, { method: "DELETE" });
}

export function getProject(projectId: string) {
  return request<ProjectAggregate>(`/api/projects/${projectId}`);
}

export function getProjectDiagnostics(projectId: string) {
  return request<ProjectDiagnostics>(`/api/projects/${projectId}/diagnostics`);
}

export function getProjectCommandCenter(projectId: string) {
  return request<ProjectCommandCenter>(`/api/projects/${projectId}/command-center`);
}

export function createVisualDesign(projectId: string, payload: VisualDesignRequest) {
  return request<VisualDesignPackage>(`/api/projects/${projectId}/visual-design`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function saveParcel(projectId: string, payload: { points?: Coordinate[]; geojson?: unknown; dxf_text?: string; north_angle_deg?: number; source?: "manual" | "geojson" | "dxf" }) {
  return request<Parcel>(`/api/projects/${projectId}/parcels`, {
    method: "POST",
    body: JSON.stringify({ north_angle_deg: 0, source: "manual", ...payload })
  });
}

export function parseBrief(projectId: string, userText: string) {
  return request<PlanningBrief>(`/api/projects/${projectId}/brief`, {
    method: "POST",
    body: JSON.stringify({ user_text: userText })
  });
}

export function saveConstraints(projectId: string, payload: ConstraintSet) {
  return request<ConstraintSet>(`/api/projects/${projectId}/constraints`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createPrototype(projectId: string, payload: Omit<BuildingPrototype, "id">) {
  return request<BuildingPrototype>(`/api/projects/${projectId}/prototypes`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePrototype(projectId: string, prototypeId: string, payload: Omit<BuildingPrototype, "id">) {
  return request<BuildingPrototype>(`/api/projects/${projectId}/prototypes/${prototypeId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deletePrototype(projectId: string, prototypeId: string) {
  return request<{ deleted: boolean; prototype_id: string }>(`/api/projects/${projectId}/prototypes/${prototypeId}`, {
    method: "DELETE"
  });
}

export function generateSiteOptions(projectId: string) {
  return request<JobStatus>(`/api/projects/${projectId}/generate-site-options`, { method: "POST" });
}

export function getJob(jobId: string) {
  return request<JobStatus>(`/api/jobs/${jobId}`);
}

export function getOptions(projectId: string) {
  return request<SiteOption[]>(`/api/projects/${projectId}/options`);
}

export function getOption(optionId: string) {
  return request<SiteOption>(`/api/options/${optionId}`);
}

export function getOptionReview(optionId: string) {
  return request<OptionReview>(`/api/options/${optionId}/review`);
}

export function createInvestmentMemo(optionId: string) {
  return request<InvestmentMemo>(`/api/options/${optionId}/investment-memo`, { method: "POST" });
}

export function createDueDiligence(optionId: string) {
  return request<DueDiligencePack>(`/api/options/${optionId}/due-diligence`, { method: "POST" });
}

export function explainOption(optionId: string) {
  return request<{ option_id: string; explanation: string }>(`/api/options/${optionId}/explain`, { method: "POST" });
}

export function deriveOption(optionId: string, payload: { name?: string; keep_indexes?: number[]; remove_indexes?: number[]; locked_indexes?: number[] }) {
  return request<SiteOption>(`/api/options/${optionId}/derive`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getSensitivity(optionId: string) {
  return request<{ option_id: string; scenarios: SensitivityScenario[] }>(`/api/options/${optionId}/sensitivity`);
}

export function createOptionReport(optionId: string) {
  return request<{ option_id: string; download_path: string; local_path: string }>(`/api/options/${optionId}/report`, {
    method: "POST"
  });
}

export function exportOption(optionId: string, format: "geojson" | "dxf" | "csv") {
  return request<{ format: string; download_path: string; local_path: string }>(`/api/options/${optionId}/export?format=${format}`, {
    method: "POST"
  });
}

export function buildDownloadUrl(path: string) {
  return apiUrl(path);
}

export function getOpenAISettings() {
  return request<OpenAISettingsStatus>("/api/settings/openai");
}

export function saveOpenAISettings(payload: { api_key?: string; model_text?: string; model_fast?: string }) {
  return request<OpenAISettingsStatus>("/api/settings/openai", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function clearOpenAISettings() {
  return request<OpenAISettingsStatus>("/api/settings/openai", { method: "DELETE" });
}
