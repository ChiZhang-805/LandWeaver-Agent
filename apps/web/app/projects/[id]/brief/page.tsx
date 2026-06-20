"use client";

import { ArrowRight, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { getProject, parseBrief } from "@/lib/api";
import type { PlanningBrief } from "@/lib/types";

const sampleText = "改善型住宅，面向三口之家和轻奢换房客户，偏稳健，关注收益和风险平衡，户型以90-120平为主。";

export default function BriefPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [text, setText] = useState(sampleText);
  const [brief, setBrief] = useState<PlanningBrief | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getProject(projectId)
      .then((aggregate) => {
        if (aggregate.brief) setBrief(aggregate.brief);
      })
      .catch(() => undefined);
  }, [projectId]);

  async function submit() {
    try {
      const result = await parseBrief(projectId, text);
      setBrief(result);
      setStatus("已保存简报");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "解析失败");
    }
  }

  return (
    <Shell projectId={projectId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">BRIEF</p>
          <h1 className="page-title mt-2">产品与策略简报</h1>
          <p className="page-copy mt-2">客户、定位、户型和风险偏好。</p>
        </div>
        <div className="flex gap-2">
          <button title="解析简报" className="icon-button bg-teal text-white" onClick={submit}>
            <WandSparkles size={16} aria-hidden />
            <span>解析</span>
          </button>
          <Link className="icon-button border border-line bg-white" href={`/projects/${projectId}/constraints`}>
            <ArrowRight size={16} aria-hidden />
            <span>下一步</span>
          </Link>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="panel p-5">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            <span className="section-title">开发需求</span>
            <textarea
              className="textarea-control"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
        </div>
        <div className="panel p-5">
          {brief ? (
            <div className="grid gap-4 text-sm">
              <div>
                <h2 className="section-title">解析结果</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{brief.product_positioning}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="ok">{brief.strategy_preference}</StatusPill>
                <StatusPill tone={brief.risk_preference === "low" ? "ok" : brief.risk_preference === "medium" ? "warn" : "risk"}>
                  risk {brief.risk_preference}
                </StatusPill>
              </div>
              <dl className="grid gap-3">
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
                        <StatusPill key={key}>{key} {(value * 100).toFixed(0)}%</StatusPill>
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
            <div className="empty-state">
              <p className="font-bold text-ink">等待简报解析</p>
            </div>
          )}
        </div>
      </div>
      {status ? <p className={`mt-3 status-message ${status.includes("失败") ? "danger-message" : ""}`}>{status}</p> : null}
    </Shell>
  );
}
