"use client";

import { ArrowLeft, ArrowRight, Save, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { getProject, parseBrief, previewBrief, saveBrief } from "@/lib/api";
import { riskLabel, strategyLabel } from "@/lib/labels";
import { notifyProjectUpdated } from "@/lib/projectEvents";
import type { PlanningBrief } from "@/lib/types";

const sampleText = "改善型住宅，面向三口之家和轻奢换房客户，偏稳健，关注收益和风险平衡，户型以90-120平为主。";

function unitLabel(value: string) {
  return value.replace("m2", "㎡");
}

export default function BriefPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [text, setText] = useState(sampleText);
  const [brief, setBrief] = useState<PlanningBrief | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getProject(projectId)
      .then((aggregate) => {
        if (aggregate.brief) {
          setBrief(aggregate.brief);
          setIsSaved(true);
        } else {
          setIsSaved(false);
        }
        setStatus("");
      })
      .catch((event) => {
        setStatus(event instanceof Error ? `简报加载失败：${event.message}` : "简报加载失败");
      });
  }, [projectId]);

  function updateText(value: string) {
    setText(value);
    setBrief(null);
    setIsSaved(false);
  }

  async function submit() {
    try {
      setBusy(true);
      setStatus("");
      const result = brief ? await saveBrief(projectId, brief) : await parseBrief(projectId, text);
      setBrief(result);
      setIsSaved(true);
      notifyProjectUpdated(projectId);
      setStatus("");
    } catch (event) {
      setIsSaved(false);
      setStatus(event instanceof Error ? event.message : "解析失败");
    } finally {
      setBusy(false);
    }
  }

  async function generatePreview() {
    try {
      setBusy(true);
      setStatus("");
      const result = await previewBrief(projectId, text);
      setBrief(result);
      setIsSaved(false);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "解析失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell projectId={projectId} currentStepReady={isSaved}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-4">
          <div>
            <p className="page-kicker">BRIEF</p>
            <h1 className="page-title mt-2">产品与策略简报</h1>
            <p className="page-copy mt-2">客户、定位、户型和风险偏好。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button title="生成解析" className="icon-button border border-line bg-white" disabled={busy} onClick={generatePreview}>
              <WandSparkles size={16} aria-hidden />
              <span>{busy ? "生成中" : "生成"}</span>
            </button>
            <button title="保存简报" className="icon-button bg-teal text-white" disabled={busy} onClick={submit}>
              <Save size={16} aria-hidden />
              <span>保存</span>
            </button>
            <Link className="icon-button border border-line bg-white" href={`/projects/${projectId}/parcel`}>
              <ArrowLeft size={16} aria-hidden />
              <span>上一步</span>
            </Link>
            {isSaved ? (
              <Link className="icon-button border border-line bg-white" href={`/projects/${projectId}/constraints`}>
                <ArrowRight size={16} aria-hidden />
                <span>下一步</span>
              </Link>
            ) : (
              <button className="icon-button border border-line bg-white" disabled>
                <ArrowRight size={16} aria-hidden />
                <span>下一步</span>
              </button>
            )}
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="panel flex min-h-0 p-5">
            <label className="flex min-h-0 flex-1 flex-col gap-2 text-sm font-semibold text-ink">
              <span className="section-title">开发需求</span>
              <textarea
                className="textarea-control min-h-0 flex-1 resize-none"
                value={text}
                onChange={(event) => updateText(event.target.value)}
              />
            </label>
          </div>
          <div className="panel flex min-h-0 flex-col p-5">
            {brief ? (
              <div className="flex min-h-0 flex-1 flex-col text-sm">
                <div className="shrink-0">
                  <h2 className="section-title">解析结果</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{brief.product_positioning}</p>
                </div>
                <div className="mt-4 flex shrink-0 flex-wrap gap-2">
                  <StatusPill tone="ok">{strategyLabel(brief.strategy_preference)}</StatusPill>
                  <StatusPill tone={brief.risk_preference === "low" ? "ok" : brief.risk_preference === "medium" ? "warn" : "risk"}>
                    {riskLabel(brief.risk_preference)}
                  </StatusPill>
                </div>
                <dl className="mt-4 grid min-h-0 flex-1 gap-3 overflow-y-auto pr-1">
                  <div>
                    <dt className="text-slate-500">目标客群</dt>
                    <dd className="mt-1 font-semibold">{brief.target_customer}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">产品定位</dt>
                    <dd className="mt-1 font-semibold">{brief.product_positioning}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">户型配比</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(brief.unit_mix_targets).length ? (
                        Object.entries(brief.unit_mix_targets).map(([key, value]) => (
                          <StatusPill key={key}>{unitLabel(key)} {(value * 100).toFixed(0)}%</StatusPill>
                        ))
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">备注</dt>
                    <dd className="mt-1 leading-6 text-slate-700">{brief.notes || "-"}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="empty-state h-full">
                <p className="font-bold text-ink">等待简报解析</p>
              </div>
            )}
          </div>
        </div>
        {status ? <p className={`mt-3 shrink-0 status-message ${status.includes("失败") ? "danger-message" : ""}`}>{status}</p> : null}
      </div>
    </Shell>
  );
}
