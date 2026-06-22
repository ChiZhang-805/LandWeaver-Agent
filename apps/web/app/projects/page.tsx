"use client";

import { Archive, Copy, FolderOpen, Plus, RefreshCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { createProject, deleteProject, duplicateProject, listProjects, updateProject } from "@/lib/api";
import type { Project } from "@/lib/types";

function date(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: string) {
  return status === "archived" ? "已归档" : status === "active" ? "推进中" : "草稿";
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("120m x 80m 住宅地块测算");
  const [city, setCity] = useState("Shanghai");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function load() {
    try {
      setLoading(true);
      setStatus("");
      setProjects(await listProjects(true));
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function archive(project: Project) {
    try {
      const next = await updateProject(project.id, { status: project.status === "archived" ? "draft" : "archived" });
      setProjects((current) => current.map((item) => (item.id === next.id ? next : item)));
      setStatus(next.status === "archived" ? `已归档 ${next.title}` : `已恢复 ${next.title}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "状态更新失败");
    }
  }

  async function duplicate(project: Project) {
    try {
      const aggregate = await duplicateProject(project.id);
      setProjects((current) => [aggregate.project, ...current]);
      setStatus(`已复制 ${project.title}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "复制失败");
    }
  }

  async function remove(project: Project) {
    if (!window.confirm(`删除项目「${project.title}」？`)) return;
    try {
      await deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setStatus(`已删除 ${project.title}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "删除失败");
    }
  }

  async function createFromDashboard() {
    if (!title.trim() || !city.trim()) {
      setStatus("请填写项目名称和城市");
      return;
    }
    try {
      const project = await createProject({ title: title.trim(), city: city.trim() });
      setProjects((current) => [project, ...current]);
      setStatus(`已创建 ${project.title}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "创建失败");
    }
  }

  const activeCount = projects.filter((project) => project.status !== "archived").length;
  const archivedCount = projects.length - activeCount;
  const latest = projects[0];

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">PROJECTS</p>
          <h1 className="page-title mt-2">项目 Dashboard</h1>
          <p className="page-copy mt-2">地块项目与方案资产。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button title="刷新" className="icon-button border border-line bg-white text-ink" onClick={load}>
            <RefreshCcw size={16} aria-hidden />
            <span>刷新</span>
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="panel p-4">
            <p className="text-xs font-bold text-slate-500">全部项目</p>
            <p className="mt-2 text-3xl font-black text-ink">{projects.length}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs font-bold text-slate-500">推进中</p>
            <p className="mt-2 text-3xl font-black text-teal">{activeCount}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs font-bold text-slate-500">归档</p>
            <p className="mt-2 text-3xl font-black text-slate-500">{archivedCount}</p>
          </div>
        </div>
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="section-title">快速项目</h2>
            {latest ? <span className="text-xs font-semibold text-slate-500">最近：{latest.city}</span> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <label className="grid gap-1.5 text-sm font-semibold">
              <span className="text-xs text-slate-500">项目名称</span>
              <input className="input-control" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              <span className="text-xs text-slate-500">城市</span>
              <input className="input-control" value={city} onChange={(event) => setCity(event.target.value)} />
            </label>
            <button title="创建项目" className="icon-button self-end bg-teal text-white" onClick={createFromDashboard}>
              <Plus size={16} aria-hidden />
              <span>创建</span>
            </button>
          </div>
        </div>
      </div>

      <div className="panel p-4">
        {projects.length ? (
          <div className="grid gap-3">
            {projects.map((project) => (
              <article key={project.id} className="rounded-[8px] border border-line/80 bg-white p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_150px_120px_170px_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="break-words font-bold text-ink">{project.title}</div>
                    <div className="mt-1 break-all text-xs font-semibold text-slate-500">{project.id}</div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 lg:hidden">城市</p>
                    <p className="mt-1 font-semibold text-ink lg:mt-0">{project.city}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 lg:hidden">状态</p>
                    <div className="mt-1 lg:mt-0">
                      <StatusPill tone={project.status === "archived" ? "neutral" : "ok"}>{statusLabel(project.status)}</StatusPill>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 lg:hidden">创建时间</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600 lg:mt-0">{date(project.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link title="打开" className="icon-button border border-line bg-white" href={`/projects/${project.id}/parcel`}>
                      <FolderOpen size={15} aria-hidden />
                    </Link>
                    <button title="复制" className="icon-button border border-line bg-white" onClick={() => duplicate(project)}>
                      <Copy size={15} aria-hidden />
                    </button>
                    <button title="归档/恢复" className="icon-button border border-line bg-white" onClick={() => archive(project)}>
                      <Archive size={15} aria-hidden />
                    </button>
                    <button title="删除" className="icon-button border border-line bg-white text-rose" onClick={() => remove(project)}>
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <p className="font-bold text-ink">{loading ? "项目加载中" : "暂无项目"}</p>
              <p className="mt-2 text-sm text-slate-500">当前没有项目记录。</p>
            </div>
          </div>
        )}
      </div>
      {status ? <p className={`mt-3 status-message ${status.includes("失败") || status.includes("请填写") ? "danger-message" : ""}`}>{status}</p> : null}
    </Shell>
  );
}
