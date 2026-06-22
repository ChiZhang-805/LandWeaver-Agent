"use client";

import { ChartNoAxesCombined, ClipboardList, Download, FileText, GitBranch, Landmark, MessageSquareText, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MetricGrid } from "@/components/MetricGrid";
import { DueDiligencePanel } from "@/components/DueDiligencePanel";
import { InvestmentMemoPanel } from "@/components/InvestmentMemoPanel";
import { OptionCanvas } from "@/components/OptionCanvas";
import { OptionReviewPanel } from "@/components/OptionReviewPanel";
import { OptionScene3D } from "@/components/OptionScene3D";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { buildDownloadUrl, createDueDiligence, createInvestmentMemo, createOptionReport, deriveOption, explainOption, exportOption, getOption, getOptionReview, getProject, getSensitivity } from "@/lib/api";
import type { DueDiligencePack, InvestmentMemo, OptionReview, Parcel, SensitivityScenario, SiteOption } from "@/lib/types";

function money(value: number) {
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function variableLabel(value: SensitivityScenario["variable"]) {
  return value === "avg_selling_price_cny_per_m2" ? "售价" : "建安成本";
}

export default function OptionDetailPage() {
  const params = useParams<{ id: string; optionId: string }>();
  const router = useRouter();
  const projectId = params.id;
  const optionId = params.optionId;
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [option, setOption] = useState<SiteOption | null>(null);
  const [review, setReview] = useState<OptionReview | null>(null);
  const [memo, setMemo] = useState<InvestmentMemo | null>(null);
  const [diligence, setDiligence] = useState<DueDiligencePack | null>(null);
  const [explanation, setExplanation] = useState("");
  const [sensitivity, setSensitivity] = useState<SensitivityScenario[]>([]);
  const [removeIndexes, setRemoveIndexes] = useState<number[]>([]);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setStatus("");
      const [aggregate, detail] = await Promise.all([getProject(projectId), getOption(optionId)]);
      setParcel(aggregate.parcel);
      setOption(detail);
      setMemo(null);
      setDiligence(null);
      setExplanation("");
      setSensitivity([]);
      setRemoveIndexes([]);
      try {
        setReview(await getOptionReview(optionId));
      } catch (reviewError) {
        setReview(null);
        setStatus(reviewError instanceof Error ? `方案评审加载失败：${reviewError.message}` : "方案评审加载失败");
      }
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "加载失败");
    }
  }, [optionId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function explain() {
    try {
      const result = await explainOption(optionId);
      setExplanation(result.explanation);
      setStatus("解释已更新");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "解释失败");
    }
  }

  async function exportAs(format: "geojson" | "dxf" | "csv") {
    try {
      const result = await exportOption(optionId, format);
      window.open(buildDownloadUrl(result.download_path), "_blank", "noopener,noreferrer");
      setStatus(`${format.toUpperCase()} 已导出：${result.local_path}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "导出失败");
    }
  }

  async function loadSensitivity() {
    try {
      const result = await getSensitivity(optionId);
      setSensitivity(result.scenarios);
      setStatus("敏感性已更新");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "敏感性分析失败");
    }
  }

  async function loadInvestmentMemo() {
    try {
      const result = await createInvestmentMemo(optionId);
      setMemo(result);
      setStatus("投决备忘录已更新");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "投决备忘录生成失败");
    }
  }

  async function loadDueDiligence() {
    try {
      const result = await createDueDiligence(optionId);
      setDiligence(result);
      setStatus("尽调证据包已更新");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "尽调证据包生成失败");
    }
  }

  async function derive() {
    if (!option || !removeIndexes.length) return;
    try {
      const result = await deriveOption(option.id, { name: "manual edit", remove_indexes: removeIndexes });
      router.push(`/projects/${projectId}/options/${result.id}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "派生失败");
    }
  }

  async function report() {
    try {
      const result = await createOptionReport(optionId);
      window.open(buildDownloadUrl(result.download_path), "_blank", "noopener,noreferrer");
      setStatus(`报告已生成：${result.local_path}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "报告生成失败");
    }
  }

  function toggleRemove(index: number) {
    setRemoveIndexes((current) => (current.includes(index) ? current.filter((item) => item !== index) : [...current, index]));
  }

  return (
    <Shell projectId={projectId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">OPTION DETAIL</p>
          <h1 className="page-title mt-2">方案详情</h1>
          <p className="page-copy mt-2">{option ? `${option.strategy} · score ${option.score.toFixed(1)} · seed ${option.seed}` : "方案数据加载中"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button title="刷新" className="icon-button border border-line bg-white" onClick={load}>
            <RefreshCcw size={16} aria-hidden />
          </button>
          <button title="AI 解释" className="icon-button border border-line bg-white" onClick={explain}>
            <MessageSquareText size={16} aria-hidden />
            <span>解释</span>
          </button>
          <button title="敏感性分析" className="icon-button border border-line bg-white" onClick={loadSensitivity}>
            <ChartNoAxesCombined size={16} aria-hidden />
            <span>敏感性</span>
          </button>
          <button title="投决备忘录" className="icon-button border border-line bg-white" onClick={loadInvestmentMemo}>
            <Landmark size={16} aria-hidden />
            <span>投决</span>
          </button>
          <button title="尽调证据包" className="icon-button border border-line bg-white" onClick={loadDueDiligence}>
            <ClipboardList size={16} aria-hidden />
            <span>尽调</span>
          </button>
          <button title="生成报告" className="icon-button border border-line bg-white" onClick={report}>
            <FileText size={16} aria-hidden />
            <span>报告</span>
          </button>
          <Link title="报告页" className="icon-button border border-line bg-white" href={`/projects/${projectId}/options/${optionId}/report`}>
            <FileText size={16} aria-hidden />
          </Link>
          <button title="派生新方案" className="icon-button border border-line bg-white" disabled={!removeIndexes.length} onClick={derive}>
            <GitBranch size={16} aria-hidden />
            <span>派生</span>
          </button>
          {(["geojson", "dxf", "csv"] as const).map((format) => (
            <button key={format} title={`导出 ${format}`} className="icon-button bg-teal text-white" onClick={() => exportAs(format)}>
              <Download size={16} aria-hidden />
              <span>{format.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
      {option ? (
        <div className="grid gap-4">
          <MetricGrid metrics={option.metrics} />
          <OptionScene3D parcel={parcel} option={option} />
          <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
            <OptionCanvas parcel={parcel} option={option} />
            <div className="grid gap-4">
              <OptionReviewPanel review={review} />
              <InvestmentMemoPanel memo={memo} />
              <DueDiligencePanel pack={diligence} />
              <div className="panel p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  <StatusPill tone={option.violations.length ? "risk" : "ok"}>{option.strategy}</StatusPill>
                  <StatusPill>score {option.score.toFixed(1)}</StatusPill>
                </div>
                <div className="grid gap-2">
                  {option.violations.map((item) => (
                    <StatusPill key={item} tone="risk">{item}</StatusPill>
                  ))}
                  {option.risk_flags.map((item) => (
                    <StatusPill key={item} tone="warn">{item}</StatusPill>
                  ))}
                  {!option.violations.length && !option.risk_flags.length ? <StatusPill tone="ok">指标稳定</StatusPill> : null}
                </div>
                {explanation ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{explanation}</p> : null}
                {status ? <p className={`mt-4 status-message ${status.includes("失败") || status.includes("not") || status.includes("Not") ? "danger-message" : ""}`}>{status}</p> : null}
              </div>
            </div>
          </div>
          <div className="panel p-4">
            <h2 className="section-title mb-3">楼栋清单</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {option.buildings.map((building, index) => (
                <article key={`${building.prototype_id}-${index}`} className="rounded-[8px] border border-line/80 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-bold text-ink">{building.prototype_type || building.prototype_id}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">旋转 {building.rotation_deg}°</p>
                    </div>
                    <label className="inline-flex shrink-0 items-center gap-2 rounded-[8px] border border-line bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                      <input type="checkbox" checked={removeIndexes.includes(index)} onChange={() => toggleRemove(index)} />
                      删除后派生
                    </label>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500">层数</p>
                      <p className="mt-1 font-semibold text-ink">{building.floors}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">高度</p>
                      <p className="mt-1 font-semibold text-ink">{building.height_m}m</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">建面</p>
                      <p className="mt-1 font-semibold text-ink">{building.gfa_m2.toLocaleString("zh-CN")} m2</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">户数</p>
                      <p className="mt-1 font-semibold text-ink">{building.units}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
          {option.metrics.product_breakdown && typeof option.metrics.product_breakdown === "object" ? (
            <div className="panel p-4">
              <h2 className="section-title mb-3">产品拆分</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(option.metrics.product_breakdown as Record<string, { building_count: number; gfa_m2: number; units: number; revenue_cny: number }>).map(([key, value]) => (
                  <article key={key} className="rounded-[8px] border border-line/80 bg-white p-4">
                    <h3 className="break-words font-bold text-ink">{key}</h3>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-bold text-slate-500">楼栋</p>
                        <p className="mt-1 font-semibold text-ink">{value.building_count}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500">户数</p>
                        <p className="mt-1 font-semibold text-ink">{value.units}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500">建面</p>
                        <p className="mt-1 font-semibold text-ink">{value.gfa_m2.toLocaleString("zh-CN")} m2</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500">货值</p>
                        <p className="mt-1 font-semibold text-ink">{money(value.revenue_cny)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          {sensitivity.length ? (
            <div className="panel p-4">
              <h2 className="section-title mb-3">敏感性</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sensitivity.map((scenario, index) => (
                  <article key={`${scenario.variable}-${scenario.delta}-${index}`} className="rounded-[8px] border border-line/80 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-ink">{variableLabel(scenario.variable)}</h3>
                      <StatusPill tone={scenario.delta < 0 ? "warn" : "ok"}>{(scenario.delta * 100).toFixed(0)}%</StatusPill>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-bold text-slate-500">毛利率</p>
                        <p className="mt-1 font-semibold text-ink">{(scenario.gross_margin_ratio * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500">毛利</p>
                        <p className="mt-1 font-semibold text-ink">{money(scenario.gross_margin_cny)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="panel p-5 text-sm text-slate-600">加载中</div>
      )}
      {status && !option ? <p className="mt-3 status-message danger-message">{status}</p> : null}
    </Shell>
  );
}
