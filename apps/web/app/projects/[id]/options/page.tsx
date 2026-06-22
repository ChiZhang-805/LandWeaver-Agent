"use client";

import { ArrowRight, Eye, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MetricGrid } from "@/components/MetricGrid";
import { OptionCanvas } from "@/components/OptionCanvas";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { getProject } from "@/lib/api";
import { strategyLabel } from "@/lib/labels";
import type { Parcel, SiteOption } from "@/lib/types";

function format(value: unknown) {
  if (typeof value !== "number") return String(value ?? "-");
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  if (Math.abs(value) > 0 && Math.abs(value) < 1) return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export default function OptionsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [options, setOptions] = useState<SiteOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const aggregate = await getProject(projectId);
      setParcel(aggregate.parcel);
      setOptions(aggregate.options);
      setSelectedId((current) => current || aggregate.options[0]?.id || "");
    } catch (event) {
      setError(event instanceof Error ? event.message : "加载失败");
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = options.find((option) => option.id === selectedId) || options[0];

  return (
    <Shell projectId={projectId}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-kicker">OPTIONS</p>
            <h1 className="page-title mt-2">方案对比</h1>
            <p className="page-copy mt-2">强排结果、指标和收益表现。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button title="刷新方案" className="icon-button border border-line bg-white" onClick={load}>
              <RefreshCcw size={16} aria-hidden />
              <span>刷新</span>
            </button>
            <Link className="icon-button bg-teal text-white" href={`/projects/${projectId}/generate`}>
              <ArrowRight size={16} aria-hidden />
              <span>生成</span>
            </Link>
          </div>
        </div>
        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <MetricGrid compact className="shrink-0" metrics={selected.metrics} />
            <div className="mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <OptionCanvas compact className="h-full" parcel={parcel} option={selected} />
              <div className="panel min-h-0 overflow-hidden">
                <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
                  <div className="border-b border-line bg-field/70 px-4 py-3">
                    <h2 className="section-title">候选方案</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">点击卡片切换画布，右侧按钮进入详情。</p>
                  </div>
                  <div className="min-h-0 overflow-y-auto overflow-x-hidden p-3">
                    <div className="grid gap-3">
                      {options.map((option) => {
                        const active = option.id === selected?.id;
                        const tone = option.violations.length ? "risk" : option.risk_flags.length ? "warn" : "ok";
                        const metrics = [
                          ["FAR", option.metrics.far],
                          ["密度", option.metrics.building_density],
                          ["建面", option.metrics.total_gfa_m2],
                          ["户数", option.metrics.units],
                          ["货值", option.metrics.revenue_cny],
                          ["毛利率", option.metrics.gross_margin_ratio]
                        ] as const;

                        return (
                          <article
                            key={option.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={active}
                            onClick={() => setSelectedId(option.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedId(option.id);
                              }
                            }}
                            className={`rounded-[8px] border bg-white p-3 text-left transition hover:border-teal/60 hover:bg-teal/5 ${
                              active ? "border-teal shadow-[0_10px_26px_rgba(15,118,110,0.12)]" : "border-line"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <StatusPill tone={tone}>{strategyLabel(option.strategy)}</StatusPill>
                                <p className="mt-2 text-xs font-bold text-slate-500">score {option.score.toFixed(1)}</p>
                              </div>
                              <Link
                                title="方案详情"
                                className="icon-button size-9 min-h-0 border border-line bg-white p-0"
                                href={`/projects/${projectId}/options/${option.id}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Eye size={15} aria-hidden />
                              </Link>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {metrics.map(([label, value]) => (
                                <div key={label} className="rounded-[8px] border border-line bg-field px-3 py-2">
                                  <p className="text-[11px] font-black uppercase text-slate-500">{label}</p>
                                  <p className="mt-1 min-w-0 break-words text-sm font-black text-ink">{format(value)}</p>
                                </div>
                              ))}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {selected.risk_flags.length ? (
              <div className="mt-3 shrink-0 panel p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="section-title mr-1">风险标签</h2>
                  {selected.risk_flags.map((flag) => (
                    <StatusPill key={flag} tone="warn">{flag}</StatusPill>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="panel min-h-0 flex-1 p-5">
            <div className="empty-state h-full">
              <div>
                <p className="font-bold text-ink">暂无方案</p>
                <Link className="icon-button mt-4 bg-teal text-white" href={`/projects/${projectId}/generate`}>
                  <ArrowRight size={16} aria-hidden />
                  <span>生成</span>
                </Link>
              </div>
            </div>
          </div>
        )}
        {error ? <p className="mt-3 shrink-0 status-message danger-message">{error}</p> : null}
      </div>
    </Shell>
  );
}
