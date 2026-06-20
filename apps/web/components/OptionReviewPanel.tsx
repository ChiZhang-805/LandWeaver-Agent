"use client";

import { BadgeCheck, Lightbulb, Target, TriangleAlert } from "lucide-react";
import type { OptionReview } from "@/lib/types";
import { StatusPill } from "./StatusPill";

function toneFor(status: OptionReview["items"][number]["status"]): "ok" | "warn" | "risk" {
  if (status === "excellent" || status === "good") return "ok";
  if (status === "watch") return "warn";
  return "risk";
}

function gradeTone(grade: OptionReview["grade"]): "ok" | "warn" | "risk" {
  if (grade === "A" || grade === "B") return "ok";
  if (grade === "C") return "warn";
  return "risk";
}

function percent(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(0)}%` : "-";
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN", { maximumFractionDigits: 1 }) : "-";
}

export function OptionReviewPanel({ review }: { review: OptionReview | null }) {
  if (!review) {
    return (
      <div className="panel flex min-h-[220px] flex-col p-5">
        <div className="empty-state h-full">
          <p className="font-bold text-ink">等待方案评审</p>
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "FAR", value: percent(review.metrics.far_utilization) },
    { label: "密度", value: percent(review.metrics.density_ratio_to_cap) },
    { label: "毛利", value: percent(review.metrics.gross_margin_ratio) },
    { label: "户均", value: `${number(review.metrics.avg_unit_area_estimate_m2)} m2` }
  ];

  return (
    <div className="panel flex min-h-[360px] flex-col overflow-hidden p-5">
      <div className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="page-kicker">DESIGN REVIEW</p>
            <h2 className="section-title mt-1">方案质量评审</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone={gradeTone(review.grade)}>Grade {review.grade}</StatusPill>
            <StatusPill>{review.overall_score}/100</StatusPill>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{review.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-[8px] border border-line bg-white p-3">
              <p className="text-xs font-bold text-slate-500">{metric.label}</p>
              <p className="mt-1 text-base font-black text-ink">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-2">
          {review.items.map((item) => (
            <div key={item.key} className="rounded-[8px] border border-line bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {item.status === "risk" ? <TriangleAlert className="text-rose" size={15} aria-hidden /> : <BadgeCheck className="text-teal" size={15} aria-hidden />}
                  <h3 className="text-sm font-bold text-ink">{item.label}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={toneFor(item.status)}>{item.status}</StatusPill>
                  <span className="text-xs font-black text-slate-500">{item.score}</span>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.message}</p>
              {item.action ? <p className="mt-1 text-xs font-bold text-teal">{item.action}</p> : null}
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[8px] border border-teal/20 bg-teal/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-teal">
            <Lightbulb size={15} aria-hidden />
            <span>下一步动作</span>
          </div>
          <div className="grid gap-2 text-sm leading-6 text-slate-700">
            {review.next_actions.map((action) => (
              <p key={action}>{action}</p>
            ))}
          </div>
        </div>

        {review.strengths.length ? (
          <div className="mt-3 rounded-[8px] border border-line bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
              <Target size={15} aria-hidden />
              <span>优势</span>
            </div>
            <div className="grid gap-2 text-sm leading-6 text-slate-600">
              {review.strengths.map((strength) => (
                <p key={strength}>{strength}</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
