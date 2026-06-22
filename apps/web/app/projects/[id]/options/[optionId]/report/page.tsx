"use client";

import { Download, Printer, RefreshCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MetricGrid } from "@/components/MetricGrid";
import { OptionCanvas } from "@/components/OptionCanvas";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { buildDownloadUrl, createOptionReport, explainOption, getOption, getProject, getSensitivity } from "@/lib/api";
import { strategyLabel } from "@/lib/labels";
import type { Parcel, Project, SensitivityScenario, SiteOption } from "@/lib/types";

function money(value: number) {
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

export default function OptionReportPage() {
  const params = useParams<{ id: string; optionId: string }>();
  const projectId = params.id;
  const optionId = params.optionId;
  const [project, setProject] = useState<Project | null>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [option, setOption] = useState<SiteOption | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityScenario[]>([]);
  const [explanation, setExplanation] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setStatus("");
      const [aggregate, detail, sensitivityRows, explain] = await Promise.all([
        getProject(projectId),
        getOption(optionId),
        getSensitivity(optionId),
        explainOption(optionId)
      ]);
      setProject(aggregate.project);
      setParcel(aggregate.parcel);
      setOption(detail);
      setSensitivity(sensitivityRows.scenarios);
      setExplanation(explain.explanation);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "报告加载失败");
    }
  }, [optionId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadHtml() {
    try {
      const result = await createOptionReport(optionId);
      window.open(buildDownloadUrl(result.download_path), "_blank", "noopener,noreferrer");
      setStatus(`报告已生成：${result.local_path}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "报告生成失败");
    }
  }

  return (
    <Shell projectId={projectId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="page-kicker">方案报告</p>
          <h1 className="page-title mt-2">方案报告</h1>
          <p className="page-copy mt-2">{project && option ? `${project.title} · ${strategyLabel(option.strategy)}` : "报告数据加载中"}</p>
        </div>
        <div className="flex gap-2">
          <button title="刷新" className="icon-button border border-line bg-white" onClick={load}>
            <RefreshCcw size={16} aria-hidden />
          </button>
          <button title="打印" className="icon-button border border-line bg-white" onClick={() => window.print()}>
            <Printer size={16} aria-hidden />
          </button>
          <button title="下载 HTML 报告" className="icon-button bg-teal text-white" onClick={downloadHtml}>
            <Download size={16} aria-hidden />
            <span>HTML</span>
          </button>
        </div>
      </div>
      {option && project ? (
        <article className="panel grid gap-6 p-6 print:border-0 print:p-0 print:shadow-none">
          <header>
            <p className="text-sm font-semibold text-teal">地织方案报告</p>
            <h2 className="mt-2 text-3xl font-black text-ink">{project.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{project.city} · {strategyLabel(option.strategy)} · {parcel?.area_m2.toLocaleString("zh-CN")} ㎡</p>
          </header>
          <MetricGrid metrics={option.metrics} />
          <OptionCanvas parcel={parcel} option={option} />
          <section className="grid gap-3 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">风险提示</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {option.risk_flags.length ? option.risk_flags.map((item) => <StatusPill key={item} tone="warn">{item}</StatusPill>) : <StatusPill tone="ok">暂无风险</StatusPill>}
              </div>
            </div>
            <div>
              <h3 className="font-semibold">AI 说明</h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{explanation}</p>
            </div>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">敏感性</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sensitivity.map((item, index) => (
                <article key={`${item.variable}-${index}`} className="rounded-[8px] border border-line/80 bg-white p-4 print:break-inside-avoid">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-ink">{item.variable === "avg_selling_price_cny_per_m2" ? "售价" : "建安成本"}</h4>
                    <StatusPill tone={item.delta < 0 ? "warn" : "ok"}>{(item.delta * 100).toFixed(0)}%</StatusPill>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-bold text-slate-500">毛利率</p>
                      <p className="mt-1 font-semibold text-ink">{(item.gross_margin_ratio * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">毛利</p>
                      <p className="mt-1 font-semibold text-ink">{money(item.gross_margin_cny)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </article>
      ) : (
        <div className="panel p-5 text-sm text-slate-600">加载中</div>
      )}
      {status ? <p className={`mt-3 status-message print:hidden ${status.includes("失败") || status.includes("not") || status.includes("Not") ? "danger-message" : ""}`}>{status}</p> : null}
    </Shell>
  );
}
