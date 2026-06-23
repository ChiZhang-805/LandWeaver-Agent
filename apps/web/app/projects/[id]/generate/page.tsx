"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, CircleDashed, Play, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DesignDiagnosticsPanel } from "@/components/DesignDiagnosticsPanel";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { generateSiteOptions, getJob, getProject, getProjectDiagnostics } from "@/lib/api";
import { notifyProjectUpdated } from "@/lib/projectEvents";
import type { JobStatus, ProjectAggregate, ProjectDiagnostics } from "@/lib/types";

const dependencyLabels = {
  parcel: "地块红线",
  constraints: "规划约束",
  prototypes: "楼栋原型"
};

const dependencyLinks = {
  parcel: "parcel",
  constraints: "constraints",
  prototypes: "prototypes"
};

function readableError(value?: string | null) {
  if (!value) return "";
  if (value.includes("no parcel")) return "当前项目还没有保存地块红线。";
  if (value.includes("no constraint")) return "当前项目还没有保存规划与经济约束。";
  if (value.includes("no building prototypes")) return "当前项目还没有楼栋产品原型。";
  return value;
}

function stageLabel(value: string) {
  const labels: Record<string, string> = {
    queued: "任务排队",
    validating_inputs: "校验输入",
    optimizing: "强排计算",
    persisting_options: "写入结果",
    infeasible: "无可行解",
    finished: "完成"
  };
  return labels[value] || value;
}

function missingFor(aggregate: ProjectAggregate | null) {
  if (!aggregate) return ["parcel", "constraints", "prototypes"] as Array<keyof typeof dependencyLabels>;
  const items: Array<keyof typeof dependencyLabels> = [];
  if (!aggregate.parcel) items.push("parcel");
  if (!aggregate.constraints) items.push("constraints");
  if (!aggregate.prototypes.length) items.push("prototypes");
  return items;
}

export default function GeneratePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [aggregate, setAggregate] = useState<ProjectAggregate | null>(null);
  const [diagnostics, setDiagnostics] = useState<ProjectDiagnostics | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState("");
  const pollTimer = useRef<number | null>(null);

  const clearPollTimer = useCallback(() => {
    if (pollTimer.current !== null) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const loadPrerequisites = useCallback(async () => {
    try {
      setError("");
      const next = await getProject(projectId);
      setAggregate(next);
      try {
        setDiagnostics(await getProjectDiagnostics(projectId));
      } catch (diagnosticsError) {
        setDiagnostics(null);
        setError(diagnosticsError instanceof Error ? `设计诊断加载失败：${diagnosticsError.message}` : "设计诊断加载失败");
      }
      return next;
    } catch (event) {
      setError(event instanceof Error ? event.message : "项目加载失败");
      return null;
    }
  }, [projectId]);

  useEffect(() => {
    loadPrerequisites();
    return clearPollTimer;
  }, [clearPollTimer, loadPrerequisites]);

  const missing = useMemo(() => missingFor(aggregate), [aggregate]);

  const ready = aggregate !== null && missing.length === 0;
  const hasGeneratedOptions = Boolean(aggregate?.options.length || job?.result_ids.length);

  async function start() {
    const latest = await loadPrerequisites();
    const latestMissing = missingFor(latest);
    if (latestMissing.length) {
      setError(`生成前需要补齐：${latestMissing.map((item) => dependencyLabels[item]).join("、")}`);
      return;
    }
    try {
      setError("");
      const created = await generateSiteOptions(projectId);
      setJob(created);
      if (created.status === "finished" && created.result_ids.length) {
        notifyProjectUpdated(projectId);
        await loadPrerequisites();
      }
      if (created.status !== "finished") {
        clearPollTimer();
        pollTimer.current = window.setInterval(async () => {
          try {
            const next = await getJob(created.job_id);
            setJob(next);
            if (next.status === "finished" || next.status === "failed") {
              clearPollTimer();
              if (next.status === "finished" && next.result_ids.length) {
                notifyProjectUpdated(projectId);
                loadPrerequisites();
              }
            }
          } catch (event) {
            clearPollTimer();
            setError(event instanceof Error ? event.message : "任务状态刷新失败");
          }
        }, 1200);
      }
    } catch (event) {
      setError(event instanceof Error ? event.message : "生成失败");
    }
  }

  return (
    <Shell projectId={projectId} currentStepReady={hasGeneratedOptions}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-kicker">生成</p>
            <h1 className="page-title mt-2">生成强排方案</h1>
            <p className="page-copy mt-2">候选排布、指标计算和经济测算。</p>
          </div>
          <div className="flex gap-2">
            <button title="启动生成" className="icon-button bg-teal text-white" disabled={!ready} onClick={start}>
              <Play size={16} aria-hidden />
              <span>生成</span>
            </button>
            <button title="刷新" className="icon-button border border-line bg-white" onClick={() => { loadPrerequisites(); if (job) getJob(job.job_id).then(setJob); }}>
              <RefreshCcw size={16} aria-hidden />
            </button>
            <Link className="icon-button border border-line bg-white" href={`/projects/${projectId}/prototypes`}>
              <ArrowLeft size={16} aria-hidden />
              <span>上一步</span>
            </Link>
            {hasGeneratedOptions ? (
              <Link className="icon-button border border-line bg-white" href={`/projects/${projectId}/options`}>
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
        {aggregate && missing.length ? (
          <div className="panel mb-4 shrink-0 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-rose">
                  <CircleAlert size={18} aria-hidden />
                  <h2 className="section-title text-rose">生成前置条件未完成</h2>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-600">缺少：{missing.map((item) => dependencyLabels[item]).join("、")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {missing.map((item) => (
                  <Link key={item} className="icon-button border border-line bg-white" href={`/projects/${projectId}/${dependencyLinks[item]}`}>
                    <ArrowRight size={16} aria-hidden />
                    <span>去补{dependencyLabels[item]}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <DesignDiagnosticsPanel diagnostics={diagnostics} />
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden">
            <div className="panel p-4">
              <h2 className="section-title">任务状态</h2>
              <div className="mt-4 grid gap-2">
                {[
                  { key: "queued", label: "queued", sub: "任务排队" },
                  { key: "validating_inputs", label: "validate", sub: "输入校验" },
                  { key: "optimizing", label: "running", sub: "排布计算" },
                  { key: "finished", label: "finished", sub: "结果写入" }
                ].map((stage) => {
                  const order = ["queued", "validating_inputs", "optimizing", "persisting_options", "finished"];
                  const currentIndex = job ? order.indexOf(job.stage) : -1;
                  const stageIndex = order.indexOf(stage.key);
                  const failedHere = job?.status === "failed" && job.stage === stage.key;
                  const active = job?.stage === stage.key || (stage.key === "finished" && job?.stage === "persisting_options");
                  const done = job?.status === "finished" || (currentIndex > stageIndex && job?.status !== "failed");
                  return (
                    <div key={stage.key} className={`flex items-center gap-3 rounded-[8px] border p-3 ${failedHere ? "border-rose/25 bg-rose/5" : active ? "border-teal/25 bg-teal/5" : "border-line bg-white"}`}>
                      {failedHere ? (
                        <CircleAlert className="text-rose" size={18} aria-hidden />
                      ) : done ? (
                        <CheckCircle2 className="text-teal" size={18} aria-hidden />
                      ) : (
                        <CircleDashed className="text-slate-400" size={18} aria-hidden />
                      )}
                      <div>
                        <p className="font-bold text-ink">{stage.label}</p>
                        <p className="text-xs font-semibold text-slate-500">{failedHere ? "校验失败" : stage.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel min-h-0 p-5">
            {job ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill tone={job.status === "finished" ? "ok" : job.status === "failed" ? "risk" : "warn"}>{job.status}</StatusPill>
                  <span className="font-semibold">{stageLabel(job.stage)}</span>
                  <span className="text-sm text-slate-600">{job.job_id}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-[8px] bg-field">
                  <div className="h-full bg-teal transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} />
                </div>
                {job.error ? <p className="text-sm font-medium text-rose">{readableError(job.error)}</p> : null}
                {job.relax_suggestions.length ? (
                  <div className="grid gap-2 rounded-[8px] border border-line bg-field p-3 text-sm text-slate-700">
                    {job.relax_suggestions.map((suggestion) => (
                      <p key={suggestion}>{suggestion}</p>
                    ))}
                  </div>
                ) : null}
                {job.result_ids.length ? <p className="text-sm text-slate-700">{job.result_ids.length} 个方案已生成</p> : null}
                {job.status === "finished" && job.result_ids.length ? (
                  <Link className="icon-button w-fit bg-teal text-white" href={`/projects/${projectId}/options`}>
                    <ArrowRight size={16} aria-hidden />
                    <span>查看方案</span>
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="empty-state h-full">
                <p className="font-bold text-ink">等待生成任务</p>
              </div>
            )}
            </div>
          </div>
        </div>
        {error ? <p className="mt-3 shrink-0 status-message danger-message">{error}</p> : null}
      </div>
    </Shell>
  );
}
