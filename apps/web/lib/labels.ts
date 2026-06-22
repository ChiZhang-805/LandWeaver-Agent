import type { BuildingPrototype, PlanningBrief, SiteOption } from "@/lib/types";

export function strategyLabel(value: SiteOption["strategy"] | PlanningBrief["strategy_preference"] | string) {
  if (value === "revenue_first") return "收益优先";
  if (value === "balanced") return "均衡策略";
  if (value === "low_risk") return "稳健优先";
  return value;
}

export function riskLabel(value: PlanningBrief["risk_preference"] | string) {
  if (value === "low") return "低风险";
  if (value === "medium") return "中等风险";
  if (value === "high") return "高风险";
  return value;
}

export function prototypeTypeLabel(value: BuildingPrototype["type"] | string | null | undefined) {
  const normalized = String(value || "")
    .replace(/^PrototypeType\./, "")
    .trim()
    .toLowerCase();
  if (normalized === "tower") return "高层塔楼";
  if (normalized === "slab") return "板式住宅";
  if (normalized === "villa") return "低密别墅";
  if (normalized === "podium") return "配套裙房";
  return value || "-";
}
