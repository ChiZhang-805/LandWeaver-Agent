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
                <div className="h-full overflow-y-auto overflow-x-hidden">
                  <table className="data-table options-table w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[9%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[9%]" />
                      <col className="w-[13%]" />
                      <col className="w-[12%]" />
                      <col className="w-[13%]" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>策略</th>
                        <th>FAR</th>
                        <th>密度</th>
                        <th>建面</th>
                        <th>户数</th>
                        <th>货值</th>
                        <th>毛利率</th>
                        <th>详情</th>
                      </tr>
                    </thead>
                    <tbody>
                      {options.map((option) => (
                        <tr key={option.id} className={`${option.id === selected?.id ? "bg-teal/5" : ""}`} onClick={() => setSelectedId(option.id)}>
                          <td>
                            <div className="grid gap-1">
                              <StatusPill tone={option.violations.length ? "risk" : option.risk_flags.length ? "warn" : "ok"}>{option.strategy}</StatusPill>
                              <span className="text-xs font-bold text-slate-500">score {option.score.toFixed(1)}</span>
                            </div>
                          </td>
                          <td>{format(option.metrics.far)}</td>
                          <td>{format(option.metrics.building_density)}</td>
                          <td>{format(option.metrics.total_gfa_m2)}</td>
                          <td>{format(option.metrics.units)}</td>
                          <td>{format(option.metrics.revenue_cny)}</td>
                          <td>{format(option.metrics.gross_margin_ratio)}</td>
                          <td>
                            <Link title="方案详情" className="icon-button size-9 min-h-0 border border-line bg-white p-0" href={`/projects/${projectId}/options/${option.id}`}>
                              <Eye size={15} aria-hidden />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
