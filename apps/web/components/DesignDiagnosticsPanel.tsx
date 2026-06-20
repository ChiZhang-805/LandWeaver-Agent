"use client";

import { Activity, CheckCircle2, Gauge, Lightbulb, Ruler } from "lucide-react";
import type { ProjectDiagnostics } from "@/lib/types";
import { StatusPill } from "./StatusPill";

function toneFor(status: ProjectDiagnostics["checks"][number]["status"]): "ok" | "warn" | "risk" {
  if (status === "pass") return "ok";
  if (status === "warn") return "warn";
  return "risk";
}

function readinessLabel(value: ProjectDiagnostics["readiness"]) {
  if (value === "ready") return "可生成";
  if (value === "needs_attention") return "需关注";
  return "被阻断";
}

function formatNumber(value: unknown, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万${suffix}`;
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}${suffix}`;
}

function formatPercent(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(0)}%` : "-";
}

export function DesignDiagnosticsPanel({ diagnostics }: { diagnostics: ProjectDiagnostics | null }) {
  if (!diagnostics) {
    return (
      <div className="panel flex h-full min-h-0 flex-col p-5">
        <div className="empty-state h-full">
          <p className="font-bold text-ink">等待设计诊断</p>
        </div>
      </div>
    );
  }

  const coreMetrics = [
    { label: "诊断分", value: diagnostics.score, suffix: "", icon: Gauge },
    { label: "候选数", value: diagnostics.metrics.candidate_count, suffix: "", icon: Activity },
    { label: "可建面积", value: diagnostics.metrics.buildable_area_m2, suffix: " m2", icon: Ruler },
    { label: "FAR 粗判", value: formatPercent(diagnostics.metrics.estimated_far_utilization), suffix: "", icon: CheckCircle2, textValue: true }
  ];

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden p-5">
      <div className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="page-kicker">DESIGN RADAR</p>
            <h2 className="section-title mt-1">设计诊断</h2>
          </div>
          <StatusPill tone={diagnostics.readiness === "ready" ? "ok" : diagnostics.readiness === "needs_attention" ? "warn" : "risk"}>{readinessLabel(diagnostics.readiness)}</StatusPill>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{diagnostics.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {coreMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-[8px] border border-line bg-white p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <Icon size={14} aria-hidden />
                  <span>{metric.label}</span>
                </div>
                <p className="mt-1 text-lg font-black text-ink">
                  {metric.textValue ? String(metric.value) : formatNumber(metric.value, metric.suffix)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-2">
          {diagnostics.checks.map((check) => (
            <div key={check.key} className="rounded-[8px] border border-line bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-ink">{check.label}</h3>
                <StatusPill tone={toneFor(check.status)}>{check.status}</StatusPill>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{check.message}</p>
              {check.action ? <p className="mt-1 text-xs font-bold text-teal">{check.action}</p> : null}
            </div>
          ))}
        </div>

        {diagnostics.suggestions.length ? (
          <div className="mt-3 rounded-[8px] border border-teal/20 bg-teal/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-teal">
              <Lightbulb size={15} aria-hidden />
              <span>下一步建议</span>
            </div>
            <div className="grid gap-2 text-sm leading-6 text-slate-700">
              {diagnostics.suggestions.map((suggestion) => (
                <p key={suggestion}>{suggestion}</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
