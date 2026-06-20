"use client";

import { AlertTriangle, BadgeCheck, ClipboardList, Database, FileCheck2 } from "lucide-react";
import type { InvestmentMemo, InvestmentMemoMetric, InvestmentRiskRegisterItem } from "@/lib/types";
import { StatusPill } from "./StatusPill";

function recommendationTone(value: InvestmentMemo["recommendation"]): "ok" | "warn" | "risk" {
  if (value === "go") return "ok";
  if (value === "conditional_go") return "warn";
  return "risk";
}

function signalTone(value: InvestmentMemoMetric["signal"]): "ok" | "warn" | "risk" {
  if (value === "positive" || value === "neutral") return "ok";
  if (value === "watch") return "warn";
  return "risk";
}

function severityTone(value: InvestmentRiskRegisterItem["severity"]): "ok" | "warn" | "risk" {
  if (value === "low") return "ok";
  if (value === "medium") return "warn";
  return "risk";
}

function formatValue(value: InvestmentMemoMetric["value"]) {
  if (typeof value === "number") {
    if (Math.abs(value) > 0 && Math.abs(value) < 1) return `${(value * 100).toFixed(1)}%`;
    return value.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
  }
  return value ?? "-";
}

export function InvestmentMemoPanel({ memo }: { memo: InvestmentMemo | null }) {
  if (!memo) {
    return (
      <div className="panel flex min-h-[240px] flex-col p-5">
        <div className="empty-state h-full">
          <p className="font-bold text-ink">等待投决备忘录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel grid gap-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="page-kicker">INVESTMENT MEMO</p>
          <h2 className="section-title mt-1">投决备忘录</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={recommendationTone(memo.recommendation)}>{memo.recommendation}</StatusPill>
          <StatusPill>{memo.confidence_score}/100</StatusPill>
        </div>
      </div>

      <div className="rounded-[8px] border border-line bg-white p-4">
        <div className="flex items-start gap-2">
          {memo.recommendation === "go" ? <BadgeCheck className="mt-0.5 text-teal" size={17} aria-hidden /> : <AlertTriangle className="mt-0.5 text-amber-600" size={17} aria-hidden />}
          <p className="text-sm font-semibold leading-6 text-slate-700">{memo.executive_summary}</p>
        </div>
        <p className="mt-3 text-xs font-bold text-slate-500">{memo.sensitivity_summary}</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {memo.key_metrics.slice(0, 9).map((metric) => (
          <div key={metric.key} className="rounded-[8px] border border-line bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-500">{metric.label}</p>
              <StatusPill tone={signalTone(metric.signal)}>{metric.signal}</StatusPill>
            </div>
            <p className="mt-2 text-lg font-black text-ink">{formatValue(metric.value)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{metric.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[8px] border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <FileCheck2 size={16} className="text-teal" aria-hidden />
            <span>风险登记</span>
          </div>
          <div className="grid gap-2">
            {memo.risk_register.length ? (
              memo.risk_register.map((item) => (
                <div key={item.key} className="rounded-[8px] border border-line bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusPill tone={severityTone(item.severity)}>{item.severity}</StatusPill>
                    <span className="text-xs font-black uppercase text-slate-500">{item.owner}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{item.risk}</p>
                  <p className="mt-1 text-xs font-bold text-teal">{item.mitigation}</p>
                </div>
              ))
            ) : (
              <p className="rounded-[8px] bg-teal/5 p-3 text-sm font-semibold text-slate-700">暂无高优先级风险登记。</p>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <Database size={16} className="text-teal" aria-hidden />
            <span>数据室清单</span>
          </div>
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            {memo.data_room_checklist.map((item) => (
              <p key={item} className="rounded-[8px] bg-slate-50 px-3 py-2">{item}</p>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[8px] border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <ClipboardList size={16} className="text-teal" aria-hidden />
            <span>投委会问题</span>
          </div>
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            {memo.committee_questions.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
        <section className="rounded-[8px] border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <BadgeCheck size={16} className="text-teal" aria-hidden />
            <span>下一步动作</span>
          </div>
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            {memo.next_actions.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
