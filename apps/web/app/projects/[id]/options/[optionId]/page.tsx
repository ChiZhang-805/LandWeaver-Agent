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
          <div className="panel overflow-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="px-4 py-3">原型</th>
                  <th className="px-4 py-3">层数</th>
                  <th className="px-4 py-3">高度</th>
                  <th className="px-4 py-3">建面</th>
                  <th className="px-4 py-3">户数</th>
                  <th className="px-4 py-3">旋转</th>
                  <th className="px-4 py-3">编辑</th>
                </tr>
              </thead>
              <tbody>
                {option.buildings.map((building, index) => (
                  <tr key={`${building.prototype_id}-${index}`}>
                    <td className="px-4 py-3 font-bold">{building.prototype_type || building.prototype_id}</td>
                    <td className="px-4 py-3">{building.floors}</td>
                    <td className="px-4 py-3">{building.height_m}m</td>
                    <td className="px-4 py-3">{building.gfa_m2.toLocaleString("zh-CN")} m2</td>
                    <td className="px-4 py-3">{building.units}</td>
                    <td className="px-4 py-3">{building.rotation_deg}°</td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input type="checkbox" checked={removeIndexes.includes(index)} onChange={() => toggleRemove(index)} />
                        删除后派生
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {option.metrics.product_breakdown && typeof option.metrics.product_breakdown === "object" ? (
            <div className="panel overflow-auto">
              <table className="data-table min-w-[680px]">
                <thead>
                  <tr>
                    <th className="px-4 py-3">产品</th>
                    <th className="px-4 py-3">楼栋</th>
                    <th className="px-4 py-3">建面</th>
                    <th className="px-4 py-3">户数</th>
                    <th className="px-4 py-3">货值</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(option.metrics.product_breakdown as Record<string, { building_count: number; gfa_m2: number; units: number; revenue_cny: number }>).map(([key, value]) => (
                    <tr key={key} className="border-t border-line">
                      <td className="px-4 py-3 font-semibold">{key}</td>
                      <td className="px-4 py-3">{value.building_count}</td>
                      <td className="px-4 py-3">{value.gfa_m2.toLocaleString("zh-CN")} m2</td>
                      <td className="px-4 py-3">{value.units}</td>
                      <td className="px-4 py-3">{money(value.revenue_cny)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {sensitivity.length ? (
            <div className="panel overflow-auto">
              <table className="data-table min-w-[680px]">
                <thead>
                  <tr>
                    <th className="px-4 py-3">变量</th>
                    <th className="px-4 py-3">扰动</th>
                    <th className="px-4 py-3">毛利率</th>
                    <th className="px-4 py-3">毛利</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.map((scenario, index) => (
                    <tr key={`${scenario.variable}-${scenario.delta}-${index}`} className="border-t border-line">
                      <td className="px-4 py-3 font-semibold">{variableLabel(scenario.variable)}</td>
                      <td className="px-4 py-3">{(scenario.delta * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3">{(scenario.gross_margin_ratio * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3">{money(scenario.gross_margin_cny)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
