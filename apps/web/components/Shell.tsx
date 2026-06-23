"use client";

import { Blocks, ChartNoAxesCombined, ClipboardList, Database, FileText, FolderKanban, Home, LandPlot, Map, Palette, Ruler, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getProject } from "@/lib/api";
import { PROJECT_UPDATED_EVENT } from "@/lib/projectEvents";
import type { ProjectAggregate } from "@/lib/types";

const flowSteps = [
  { label: "地块", href: "parcel", icon: Map },
  { label: "简报", href: "brief", icon: FileText },
  { label: "约束", href: "constraints", icon: Ruler },
  { label: "原型", href: "prototypes", icon: Blocks },
  { label: "生成", href: "generate", icon: Sparkles },
  { label: "方案", href: "options", icon: ChartNoAxesCombined },
  { label: "视觉", href: "visual", icon: Palette }
];

const utilityLinks = [
  { label: "首页", href: "/", icon: Home },
  { label: "项目", href: "/projects", icon: FolderKanban },
  { label: "设置", href: "/settings", icon: Settings },
  { label: "指挥", href: "command", icon: ClipboardList },
  { label: "数据", href: "data", icon: Database }
];

function isStepCompleted(aggregate: ProjectAggregate | null, href: string) {
  if (!aggregate) return false;
  if (href === "parcel") return Boolean(aggregate.parcel?.boundary?.length && aggregate.parcel.boundary.length >= 3);
  if (href === "brief") return Boolean(aggregate.brief);
  if (href === "constraints") return Boolean(aggregate.constraints);
  if (href === "prototypes") return aggregate.prototypes.length > 0;
  if (href === "generate") return aggregate.options.length > 0;
  if (href === "options") return aggregate.options.length > 0;
  return false;
}

function previousStepsCompleted(aggregate: ProjectAggregate | null, index: number) {
  return flowSteps.slice(0, index).every((step) => isStepCompleted(aggregate, step.href));
}

export function Shell({
  projectId,
  currentStepReady,
  children
}: {
  projectId?: string;
  currentStepReady?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [aggregate, setAggregate] = useState<ProjectAggregate | null>(null);
  const activeStepIndex = projectId
    ? flowSteps.findIndex((step) => {
        const href = `/projects/${projectId}/${step.href}`;
        return pathname === href || pathname.startsWith(`${href}/`);
      })
    : -1;

  const loadProjectProgress = useCallback(async () => {
    if (!projectId) {
      setAggregate(null);
      return;
    }
    try {
      setAggregate(await getProject(projectId));
    } catch {
      setAggregate(null);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectProgress();
  }, [loadProjectProgress]);

  useEffect(() => {
    if (!projectId) return;
    const refresh = (event?: Event) => {
      const customEvent = event as CustomEvent<{ projectId?: string }> | undefined;
      if (!customEvent?.detail?.projectId || customEvent.detail.projectId === projectId) {
        loadProjectProgress();
      }
    };
    window.addEventListener(PROJECT_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(PROJECT_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadProjectProgress, projectId]);

  function isFlowStepAllowed(index: number) {
    if (index === 0) return true;
    if (index === activeStepIndex) return true;
    if (activeStepIndex >= 0 && index < activeStepIndex) return true;
    if (activeStepIndex >= 0 && index > activeStepIndex && currentStepReady === false) return false;
    if (activeStepIndex >= 0 && index > activeStepIndex) {
      return flowSteps.slice(0, index).every((step, stepIndex) => {
        if (stepIndex === activeStepIndex && currentStepReady !== undefined) return currentStepReady;
        return isStepCompleted(aggregate, step.href);
      });
    }
    return previousStepsCompleted(aggregate, index);
  }

  return (
    <main className="flex h-[100svh] min-h-0 flex-col overflow-hidden">
      <header className="z-40 shrink-0 border-b border-line/80 bg-white/[0.88] shadow-[0_8px_28px_rgba(23,32,42,0.05)] backdrop-blur print:hidden">
        <div className="flex w-full flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex shrink-0 items-center gap-3 text-ink">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-teal/20 bg-teal/10 text-teal">
              <LandPlot size={20} aria-hidden />
            </span>
            <span>
              <span className="block text-base font-black leading-5">LandWeaver Agent（地织）</span>
              <span className="block text-xs font-semibold text-slate-500">Prototype planning engine</span>
            </span>
          </Link>
          <nav className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-1 lg:justify-end">
            {projectId
              ? flowSteps.map((step, index) => {
                  const Icon = step.icon;
                  const href = `/projects/${projectId}/${step.href}`;
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  const allowed = isFlowStepAllowed(index);
                  if (!allowed) {
                    return (
                      <button
                        key={step.href}
                        type="button"
                        className="icon-button cursor-not-allowed border border-line bg-white text-slate-400 opacity-60"
                        disabled
                        title="请先保存当前环节"
                      >
                        <Icon size={16} aria-hidden />
                        <span>{step.label}</span>
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={step.href}
                      href={href}
                      className={`icon-button border ${
                        active ? "border-teal bg-teal text-white" : "border-line bg-white text-ink hover:border-teal"
                      }`}
                    >
                      <Icon size={16} aria-hidden />
                      <span>{step.label}</span>
                    </Link>
                  );
                })
              : utilityLinks.slice(0, 3).map((link) => {
                  const Icon = link.icon;
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`icon-button border ${
                        active ? "border-teal bg-teal text-white" : "border-line bg-white text-ink hover:border-teal"
                      }`}
                    >
                      <Icon size={16} aria-hidden />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
          </nav>
        </div>
      </header>
      <div className="flex min-h-0 w-full flex-1 overflow-hidden px-5 print:block">
        {projectId ? (
          <aside className="hidden w-32 shrink-0 overflow-y-auto border-r border-line/70 py-5 pr-3 xl:block print:hidden">
            <nav className="grid gap-2">
              {utilityLinks.map((link) => {
                const Icon = link.icon;
                const href = link.href.startsWith("/") ? link.href : `/projects/${projectId}/${link.href}`;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={link.label}
                    href={href}
                    className={`flex min-h-10 items-center gap-2 rounded-[8px] border px-3 text-sm font-bold transition ${
                      active ? "border-teal bg-teal text-white" : "border-line bg-white text-ink hover:border-teal"
                    }`}
                  >
                    <Icon size={15} aria-hidden />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        ) : null}
        <div data-shell-content className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 xl:pl-5">
          {children}
        </div>
      </div>
    </main>
  );
}
