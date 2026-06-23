"use client";

import { ArrowLeft, Copy, Image as ImageIcon, Palette, RefreshCcw, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OptionCanvas } from "@/components/OptionCanvas";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { createVisualDesign, getProject } from "@/lib/api";
import { strategyLabel } from "@/lib/labels";
import type { ProjectAggregate, VisualDesignPackage } from "@/lib/types";

const defaultStyle = "现代高端、轻奢改善、温暖社区感，避免过度商业化，强调真实强排骨架和可达公共空间。";

function audienceLabel(value: "internal_review" | "investment_committee" | "design_presentation") {
  if (value === "investment_committee") return "投委会";
  if (value === "internal_review") return "内部评审";
  return "设计汇报";
}

function sourceLabel(value: VisualDesignPackage["source"]) {
  return value === "openai" ? "OpenAI" : "本地生成";
}

function optionDisplayLabel(index: number, strategy: string, score: number) {
  return `方案 ${index + 1}｜${strategyLabel(strategy)}｜评分 ${score.toFixed(1)}`;
}

export default function VisualDesignPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [aggregate, setAggregate] = useState<ProjectAggregate | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [stylePreference, setStylePreference] = useState(defaultStyle);
  const [referenceNotes, setReferenceNotes] = useState("");
  const [audience, setAudience] = useState<"internal_review" | "investment_committee" | "design_presentation">("design_presentation");
  const [packageData, setPackageData] = useState<VisualDesignPackage | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus("");
      const next = await getProject(projectId);
      setAggregate(next);
      setSelectedOptionId((current) => (next.options.some((option) => option.id === current) ? current : next.options[0]?.id || ""));
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "项目加载失败");
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedOption = useMemo(
    () => aggregate?.options.find((option) => option.id === selectedOptionId) || aggregate?.options[0] || null,
    [aggregate, selectedOptionId]
  );

  async function generate() {
    try {
      setBusy(true);
      setStatus("");
      setPackageData(null);
      const result = await createVisualDesign(projectId, {
        option_id: selectedOption?.id || null,
        style_preference: stylePreference,
        reference_notes: referenceNotes,
        audience
      });
      setPackageData(result);
      setStatus("视觉设计包已生成");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "视觉设计生成失败");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("提示词已复制");
    } catch {
      setStatus("复制失败，请手动选择文本");
    }
  }

  return (
    <Shell projectId={projectId} currentStepReady>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-kicker">视觉设计</p>
            <h1 className="page-title mt-2">AI 视觉设计工作台</h1>
            <p className="page-copy mt-2">基于真实强排、指标和简报生成视觉方向、材质色板、景观策略与渲染提示词。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button title="刷新项目" className="icon-button border border-line bg-white" onClick={load}>
              <RefreshCcw size={16} aria-hidden />
            </button>
            <button title="生成视觉设计包" className="icon-button bg-teal text-white" disabled={busy} onClick={generate}>
              <WandSparkles size={16} aria-hidden />
              <span>{busy ? "生成中" : "生成视觉"}</span>
            </button>
            <Link className="icon-button border border-line bg-white" href={`/projects/${projectId}/options`}>
              <ArrowLeft size={16} aria-hidden />
              <span>上一步</span>
            </Link>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="grid min-h-0 gap-4 overflow-hidden xl:grid-rows-[auto_minmax(0,1fr)]">
            <div className="panel p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="section-title">视觉输入</h2>
                <StatusPill tone={selectedOption ? "ok" : "warn"}>{selectedOption ? "绑定真实方案" : "未绑定方案"}</StatusPill>
              </div>
              <div className="grid gap-3">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  <span>绑定方案</span>
                  <select className="input-control" value={selectedOptionId} onChange={(event) => setSelectedOptionId(event.target.value)}>
                    {aggregate?.options.length ? (
                      aggregate.options.map((option, index) => (
                        <option key={option.id} value={option.id}>
                          {optionDisplayLabel(index, option.strategy, option.score)}
                        </option>
                      ))
                    ) : (
                      <option value="">暂无方案，先基于项目简报生成</option>
                    )}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  <span>汇报对象</span>
                  <select className="input-control" value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}>
                    {(["design_presentation", "investment_committee", "internal_review"] as const).map((item) => (
                      <option key={item} value={item}>{audienceLabel(item)}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  <span>风格偏好</span>
                  <textarea className="textarea-control min-h-[110px]" value={stylePreference} onChange={(event) => setStylePreference(event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  <span>参考说明</span>
                  <textarea
                    className="textarea-control min-h-[96px]"
                    placeholder="可写参考项目、立面偏好、景观气质、禁用风格等。"
                    value={referenceNotes}
                    onChange={(event) => setReferenceNotes(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="min-h-0 overflow-hidden">
              {selectedOption ? (
                <OptionCanvas compact className="h-full" parcel={aggregate?.parcel || null} option={selectedOption} />
              ) : (
                <div className="panel flex h-full min-h-[220px] items-center justify-center p-5 text-center text-sm font-semibold text-slate-500">
                  当前项目还没有方案。可以先生成视觉方向，也可以去生成页创建强排方案。
                </div>
              )}
            </div>
          </div>

          <div className="panel min-h-0 overflow-hidden p-5">
            {packageData ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="shrink-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="page-kicker">视觉设计包</p>
                      <h2 className="page-title mt-1 text-[1.65rem]">{packageData.design_title}</h2>
                    </div>
                    <StatusPill tone={packageData.source === "openai" ? "ok" : "warn"}>{sourceLabel(packageData.source)}</StatusPill>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{packageData.concept_statement}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {packageData.style_keywords.map((keyword) => (
                      <StatusPill key={keyword}>{keyword}</StatusPill>
                    ))}
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="grid gap-4">
                    <section className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[8px] border border-line bg-white p-4">
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-ink">
                          <Palette size={16} aria-hidden />
                          建筑风格
                        </h3>
                        <p className="text-sm leading-6 text-slate-700">{packageData.architectural_style}</p>
                      </div>
                      <div className="rounded-[8px] border border-line bg-white p-4">
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-ink">
                          <ImageIcon size={16} aria-hidden />
                          景观策略
                        </h3>
                        <p className="text-sm leading-6 text-slate-700">{packageData.landscape_strategy}</p>
                      </div>
                    </section>

                    <section className="rounded-[8px] border border-line bg-white p-4">
                      <h3 className="section-title">材质色板</h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {packageData.material_palette.map((color) => (
                          <div key={`${color.label}-${color.hex}`} className="grid grid-cols-[44px_1fr] gap-3 rounded-[8px] border border-line bg-field p-3">
                            <span className="size-11 rounded-[8px] border border-line" style={{ backgroundColor: color.hex }} aria-hidden />
                            <span>
                              <span className="block text-sm font-black text-ink">{color.label} · {color.hex}</span>
                              <span className="block text-xs font-bold text-slate-500">{color.material}</span>
                              <span className="mt-1 block text-xs leading-5 text-slate-600">{color.usage}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[8px] border border-line bg-white p-4">
                        <h3 className="section-title">公共空间动作</h3>
                        <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                          {packageData.public_space_moves.map((item) => <p key={item}>{item}</p>)}
                        </div>
                      </div>
                      <div className="rounded-[8px] border border-line bg-white p-4">
                        <h3 className="section-title">立面控制</h3>
                        <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                          {packageData.facade_guidelines.map((item) => <p key={item}>{item}</p>)}
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[8px] border border-line bg-white p-4">
                      <h3 className="section-title">渲染提示词</h3>
                      <div className="mt-3 grid gap-3">
                        {packageData.rendering_prompts.map((prompt) => (
                          <div key={prompt.title} className="rounded-[8px] border border-line bg-field p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-black text-ink">{prompt.title}</p>
                                <p className="text-xs font-semibold text-slate-500">{prompt.purpose}</p>
                              </div>
                              <button className="icon-button min-h-0 border border-line bg-white px-2.5 py-2 text-xs" onClick={() => copy(prompt.prompt)}>
                                <Copy size={14} aria-hidden />
                                <span>复制</span>
                              </button>
                            </div>
                            <p className="text-sm leading-6 text-slate-700">{prompt.prompt}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[8px] border border-line bg-white p-4">
                        <h3 className="section-title">汇报版式</h3>
                        <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                          {packageData.presentation_notes.map((item) => <p key={item}>{item}</p>)}
                        </div>
                      </div>
                      <div className="rounded-[8px] border border-line bg-white p-4">
                        <h3 className="section-title">边界提醒</h3>
                        <p className="mt-3 text-sm font-semibold leading-6 text-rose">{packageData.negative_prompt}</p>
                        <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
                          {packageData.cautions.map((item) => <p key={item}>{item}</p>)}
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state h-full">
                <div className="text-center">
                  <p className="font-bold text-ink">{busy ? "正在生成视觉设计包" : "等待生成视觉设计包"}</p>
                  {busy ? (
                    <div className="mx-auto mt-4 h-2 w-64 max-w-full overflow-hidden rounded-full bg-teal/10">
                      <div className="h-full w-2/3 animate-pulse rounded-full bg-teal" />
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
        {status ? <p className={`mt-3 shrink-0 status-message ${status.includes("失败") || status.includes("not") ? "danger-message" : ""}`}>{status}</p> : null}
      </div>
    </Shell>
  );
}
