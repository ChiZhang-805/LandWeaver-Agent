"use client";

import { Blocks, ChartNoAxesCombined, ClipboardList, FileText, FolderKanban, Home, LandPlot, Map, Palette, Ruler, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const steps = [
  { label: "指挥", href: "command", icon: ClipboardList },
  { label: "地块", href: "parcel", icon: Map },
  { label: "简报", href: "brief", icon: FileText },
  { label: "约束", href: "constraints", icon: Ruler },
  { label: "原型", href: "prototypes", icon: Blocks },
  { label: "生成", href: "generate", icon: Sparkles },
  { label: "方案", href: "options", icon: ChartNoAxesCombined },
  { label: "视觉", href: "visual", icon: Palette }
];

export function Shell({ projectId, children }: { projectId?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main className="flex h-[100svh] min-h-0 flex-col overflow-hidden">
      <header className="z-40 shrink-0 border-b border-line/80 bg-white/[0.88] shadow-[0_8px_28px_rgba(23,32,42,0.05)] backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex min-w-0 items-center gap-3 text-ink">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-teal/20 bg-teal/10 text-teal">
              <LandPlot size={20} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-black leading-5">LandWeaver Agent（地织）</span>
              <span className="block truncate text-xs font-semibold text-slate-500">Prototype planning engine</span>
            </span>
          </Link>
          <nav className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            <Link title="首页" href="/" className="icon-button border border-line bg-white text-ink">
              <Home size={16} aria-hidden />
              <span>首页</span>
            </Link>
            <Link
              title="项目"
              href="/projects"
              className={`icon-button border ${
                pathname === "/projects" ? "border-teal bg-teal text-white" : "border-line bg-white text-ink hover:border-teal"
              }`}
            >
              <FolderKanban size={16} aria-hidden />
              <span>项目</span>
            </Link>
            <Link
              title="设置"
              href="/settings"
              className={`icon-button border ${
                pathname === "/settings" ? "border-teal bg-teal text-white" : "border-line bg-white text-ink hover:border-teal"
              }`}
            >
              <Settings size={16} aria-hidden />
              <span>设置</span>
            </Link>
            {projectId
              ? steps.map((step) => {
                  const Icon = step.icon;
                  const href = `/projects/${projectId}/${step.href}`;
                  const active = pathname === href || pathname.startsWith(`${href}/`);
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
              : null}
          </nav>
        </div>
      </header>
      <div data-shell-content className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto overflow-x-hidden px-5 py-5">
        {children}
      </div>
    </main>
  );
}
