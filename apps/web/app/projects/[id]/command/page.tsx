"use client";

import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCcw, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { getProjectCommandCenter } from "@/lib/api";
import type { ProjectCommandCenter, WorkflowStep } from "@/lib/types";

function tone(status: WorkflowStep["status"]): "ok" | "warn" | "risk" | "neutral" {
  if (status === "done") return "ok";
  if (status === "blocked") return "risk";
  if (status === "current") return "warn";
  return "neutral";
}

function label(status: WorkflowStep["status"]) {
  if (status === "done") return "完成";
  if (status === "blocked") return "阻断";
  if (status === "current") return "当前";
  return "可执行";
}

export default function CommandCenterPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [center, setCenter] = useState<ProjectCommandCenter | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setBusy(true);
      setStatus("");
      setCenter(await getProjectCommandCenter(projectId));
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "指挥中心加载失败");
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Shell projectId={projectId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">COMMAND CENTER</p>
          <h1 className="page-title mt-2">项目指挥中心</h1>
          <p className="page-copy mt-2">{center ? center.summary : "工作流、自动化边界和投决资料准备度。"}</p>
        </div>
        <button title="刷新" className="icon-button border border-line bg-white" onClick={load} disabled={busy}>
          <RefreshCcw size={16} aria-hidden />
          <span>{busy ? "刷新中" : "刷新"}</span>
        </button>
      </div>

      {center ? (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="panel p-4">
              <p className="text-xs font-bold text-slate-500">准备度</p>
              <p className="mt-2 text-3xl font-black text-ink">{center.score}</p>
            </div>
            <div className="panel p-4">
              <p className="text-xs font-bold text-slate-500">状态</p>
              <div className="mt-2">
                <StatusPill tone={center.readiness === "ready" ? "ok" : center.readiness === "blocked" ? "risk" : "warn"}>{center.readiness}</StatusPill>
              </div>
            </div>
            <div className="panel p-4">
              <p className="text-xs font-bold text-slate-500">当前焦点</p>
              <p className="mt-2 text-xl font-black text-ink">{center.current_focus}</p>
            </div>
          </div>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {center.workflow_steps.map((step) => (
              <div key={step.key} className="panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold text-ink">{step.label}</h2>
                  <StatusPill tone={tone(step.status)}>{label(step.status)}</StatusPill>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">{step.artifact_count} artifacts</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">{step.automation_hint}</p>
                {[...step.blockers, ...step.next_actions].slice(0, 3).map((item) => (
                  <p key={item} className="mt-2 flex gap-2 text-xs leading-5 text-slate-600">
                    {step.blockers.includes(item) ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose" aria-hidden /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-teal" aria-hidden />}
                    {item}
                  </p>
                ))}
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                <Sparkles size={17} className="text-teal" aria-hidden />
                <span>大模型模块</span>
              </div>
              <div className="grid gap-2">
                {center.llm_modules.map((item) => (
                  <p key={item.key} className="rounded-[8px] bg-field px-3 py-2 text-sm leading-6 text-slate-700">
                    <span className="font-black text-ink">{item.label}</span> · {item.service_type} · {item.status}
                    <span className="mt-1 block text-xs font-semibold text-slate-500">{item.purpose}</span>
                  </p>
                ))}
              </div>
            </div>
            <div className="panel p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                <ClipboardList size={17} className="text-teal" aria-hidden />
                <span>便携式服务</span>
              </div>
              <div className="grid gap-2">
                {center.portable_services.map((item) => (
                  <p key={item.key} className="rounded-[8px] bg-field px-3 py-2 text-sm leading-6 text-slate-700">
                    <span className="font-black text-ink">{item.label}</span> · {item.service_type} · {item.status}
                    <span className="mt-1 block text-xs font-semibold text-slate-500">{item.purpose}</span>
                  </p>
                ))}
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="section-title">后端拆分原则</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
              {center.automation_plan.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="panel p-5 text-sm text-slate-600">{busy ? "加载中" : "暂无指挥中心数据"}</div>
      )}
      {status ? <p className="mt-3 status-message danger-message">{status}</p> : null}
    </Shell>
  );
}
