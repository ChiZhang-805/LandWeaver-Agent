"use client";

import { AlertTriangle, ClipboardList, Database, Sparkles } from "lucide-react";
import type { DueDiligenceGap, DueDiligencePack } from "@/lib/types";
import { StatusPill } from "./StatusPill";

function severityTone(value: DueDiligenceGap["severity"]): "ok" | "warn" | "risk" {
  if (value === "low") return "ok";
  if (value === "medium") return "warn";
  return "risk";
}

export function DueDiligencePanel({ pack }: { pack: DueDiligencePack | null }) {
  if (!pack) {
    return (
      <div className="panel flex min-h-[220px] flex-col p-5">
        <div className="empty-state h-full">
          <p className="font-bold text-ink">等待尽调证据包</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel grid gap-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="page-kicker">DUE DILIGENCE</p>
          <h2 className="section-title mt-1">尽调证据包</h2>
        </div>
        <StatusPill>{pack.evidence_gaps.length} gaps</StatusPill>
      </div>
      <div className="rounded-[8px] border border-line bg-white p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 text-amber-600" size={17} aria-hidden />
          <p className="text-sm font-semibold leading-6 text-slate-700">{pack.executive_focus}</p>
        </div>
      </div>
      <section className="rounded-[8px] border border-line bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          <ClipboardList size={16} className="text-teal" aria-hidden />
          <span>证据缺口</span>
        </div>
        <div className="grid gap-2">
          {pack.evidence_gaps.length ? (
            pack.evidence_gaps.slice(0, 8).map((gap) => (
              <div key={gap.key} className="rounded-[8px] bg-field p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-ink">{gap.label}</p>
                  <StatusPill tone={severityTone(gap.severity)}>{gap.severity}</StatusPill>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{gap.reason}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{gap.owner}</p>
              </div>
            ))
          ) : (
            <p className="rounded-[8px] bg-teal/5 p-3 text-sm font-semibold text-slate-700">暂无高优先级证据缺口。</p>
          )}
        </div>
      </section>
      <section className="rounded-[8px] border border-line bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          <Database size={16} className="text-teal" aria-hidden />
          <span>数据集检索规格</span>
        </div>
        <div className="grid gap-2">
          {pack.dataset_queries.slice(0, 5).map((query) => (
            <div key={query.key} className="rounded-[8px] bg-field p-3">
              <p className="text-sm font-black text-ink">{query.label}</p>
              <p className="mt-1 text-xs font-bold uppercase text-slate-500">{query.dataset_type} · {query.update_frequency}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{query.query_hint}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[8px] border border-line bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          <Sparkles size={16} className="text-teal" aria-hidden />
          <span>LLM / 便携服务</span>
        </div>
        <div className="grid gap-2 text-sm leading-6 text-slate-700">
          {[...pack.llm_assistants, ...pack.portable_services].slice(0, 6).map((item) => (
            <p key={item.key} className="rounded-[8px] bg-field px-3 py-2">
              <span className="font-black text-ink">{item.label}</span> · {item.service_type} · {item.status}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
