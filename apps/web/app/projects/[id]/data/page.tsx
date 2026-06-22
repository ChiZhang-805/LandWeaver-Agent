"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, Database, ExternalLink, FileSearch, Map as MapIcon, RefreshCcw, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { searchDataLibrary } from "@/lib/api";
import type { DataLibraryItem, DataLibrarySource, DataLibraryType } from "@/lib/types";

const typeOptions: { label: string; value: DataLibraryType | "" }[] = [
  { label: "全部", value: "" },
  { label: "地块", value: "parcel" },
  { label: "控规", value: "zoning" },
  { label: "市场", value: "market" },
  { label: "成本", value: "cost" },
  { label: "原型", value: "prototype" },
  { label: "交通配套", value: "mobility" },
  { label: "城市上下文", value: "context" }
];

const quickTags = ["上海", "浦东", "控规", "竞品去化", "成本", "塔楼", "配套"];

function typeLabel(type: DataLibraryType) {
  return typeOptions.find((item) => item.value === type)?.label ?? type;
}

function commercialLabel(value: DataLibrarySource["commercial_use"]) {
  if (value === "allowed") return "开放源";
  if (value === "restricted") return "研究源";
  return "待核验";
}

function licenseTone(value: DataLibrarySource["commercial_use"]) {
  if (value === "allowed") return "bg-teal/10 text-teal";
  if (value === "restricted") return "bg-amber/10 text-amber";
  return "bg-slate-100 text-slate-600";
}

function formatMetricKey(key: string) {
  return key.replaceAll("_", " ");
}

function Preview({ item }: { item: DataLibraryItem }) {
  if (item.preview_image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.preview_image_url} alt={item.title} className="h-full w-full object-cover" />;
  }
  if (item.preview_kind === "chart") {
    return (
      <div className="flex h-full items-end gap-3 bg-[#f7faf9] p-5">
        {[42, 72, 56, 88, 64].map((height, index) => (
          <span
            key={height + index}
            className="flex-1 rounded-t-[6px] bg-teal/80"
            style={{ height: `${height}%`, opacity: 0.55 + index * 0.08 }}
          />
        ))}
      </div>
    );
  }
  if (item.preview_kind === "prototype") {
    return (
      <div className="relative h-full bg-[#f6f8fa]">
        <div className="absolute bottom-6 left-8 h-[58%] w-[24%] rounded-[4px] border border-teal/35 bg-teal/12" />
        <div className="absolute bottom-6 left-[38%] h-[76%] w-[28%] rounded-[4px] border border-blue/30 bg-blue/10" />
        <div className="absolute bottom-6 right-8 h-[45%] w-[20%] rounded-[4px] border border-amber/35 bg-amber/12" />
        <div className="absolute inset-x-6 bottom-5 h-px bg-slate-300" />
      </div>
    );
  }
  if (item.preview_kind === "document") {
    return (
      <div className="h-full bg-white p-5">
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="mt-4 grid gap-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="grid grid-cols-[0.8fr_1fr_0.7fr] gap-2">
              <span className="h-3 rounded bg-teal/15" />
              <span className="h-3 rounded bg-slate-200" />
              <span className="h-3 rounded bg-amber/15" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-full overflow-hidden bg-[#edf6f4]">
      <svg viewBox="0 0 320 220" className="h-full w-full" role="img" aria-label="map preview">
        <rect width="320" height="220" fill="#edf6f4" />
        <path d="M-20 170 C 60 130, 100 170, 170 120 S 260 80, 350 112" fill="none" stroke="#94a3b8" strokeWidth="10" opacity="0.65" />
        <path d="M24 54 L116 28 L142 94 L64 122 Z" fill="#0f766e" opacity="0.2" stroke="#0f766e" strokeWidth="2" />
        <path d="M176 40 L262 58 L248 132 L168 122 Z" fill="#2563eb" opacity="0.16" stroke="#2563eb" strokeWidth="2" />
        <path d="M66 144 L145 128 L168 190 L92 204 Z" fill="#b7791f" opacity="0.17" stroke="#b7791f" strokeWidth="2" />
        {Array.from({ length: 16 }).map((_, index) => {
          const x = 24 + (index % 8) * 36;
          const y = 24 + Math.floor(index / 8) * 96;
          return <rect key={index} x={x} y={y} width="16" height="26" fill="#17202a" opacity="0.1" />;
        })}
      </svg>
    </div>
  );
}

function SourceIcon({ type }: { type: DataLibraryType }) {
  if (type === "market" || type === "cost") return <BarChart3 size={15} aria-hidden />;
  if (type === "prototype") return <Building2 size={15} aria-hidden />;
  if (type === "zoning") return <FileSearch size={15} aria-hidden />;
  return <MapIcon size={15} aria-hidden />;
}

export default function DataLibraryPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [query, setQuery] = useState("上海 控规 成本");
  const [datasetType, setDatasetType] = useState<DataLibraryType | "">("");
  const [city, setCity] = useState("上海");
  const [items, setItems] = useState<DataLibraryItem[]>([]);
  const [sources, setSources] = useState<DataLibrarySource[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);

  const load = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      setBusy(true);
      setStatus("");
      try {
        const response = await searchDataLibrary({
          query,
          datasetType,
          city,
          limit: 48
        });
        setItems(response.items);
        setSources(response.sources);
        if (!response.items.length) {
          setStatus("没有匹配数据。可以清空城市或放宽类型。");
        }
      } catch (caught) {
        setStatus(caught instanceof Error ? caught.message : "数据检索库加载失败");
      } finally {
        setBusy(false);
      }
    },
    [city, datasetType, query]
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Shell projectId={projectId}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">DATA LIBRARY</p>
          <h1 className="page-title mt-2">数据检索库</h1>
          <p className="page-copy mt-2">按城市、类型和关键词检索地块、控规、市场、成本和产品原型数据。</p>
        </div>
        <button title="刷新" className="icon-button border border-line bg-white" onClick={() => load()} disabled={busy}>
          <RefreshCcw size={16} aria-hidden />
          <span>{busy ? "刷新中" : "刷新"}</span>
        </button>
      </div>

      <section className="panel p-4">
        <form onSubmit={load} className="grid gap-3 lg:grid-cols-[1.25fr_0.65fr_0.75fr_auto]">
          <label className="min-w-0 text-sm font-bold text-ink">
            关键词
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input-control mt-2 w-full"
              placeholder="控规、竞品去化、成本、塔楼..."
            />
          </label>
          <label className="min-w-0 text-sm font-bold text-ink">
            类型
            <select
              value={datasetType}
              onChange={(event) => setDatasetType(event.target.value as DataLibraryType | "")}
              className="input-control mt-2 w-full"
            >
              {typeOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-sm font-bold text-ink">
            城市
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="input-control mt-2 w-full"
              placeholder="上海、纽约、全国"
            />
          </label>
          <button type="submit" className="icon-button mt-0 border border-teal bg-teal text-white lg:mt-7" disabled={busy}>
            <Search size={16} aria-hidden />
            <span>{busy ? "检索中" : "检索"}</span>
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {quickTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="rounded-[8px] border border-line bg-field px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-teal"
              onClick={() => setQuery((current) => (current.includes(tag) ? current : `${current} ${tag}`.trim()))}
            >
              {tag}
            </button>
          ))}
        </div>
        {status ? <p className="status-message mt-4">{status}</p> : null}
      </section>

      <section className="mt-4 panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Database size={16} aria-hidden />
            <span>可接入数据源</span>
          </div>
          <p className="text-xs font-semibold text-slate-500">当前 {items.length} 条样本。后续真实下载子集会按 manifest 替换。</p>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {sources.map((source) => (
            <a
              key={source.id}
              href={source.url.startsWith("http") ? source.url : undefined}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 rounded-[8px] border border-line bg-white p-3 transition hover:border-teal"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-bold text-ink">{source.name}</span>
                <span className={`shrink-0 rounded-[8px] px-2 py-1 text-[11px] font-black ${licenseTone(source.commercial_use)}`}>
                  {commercialLabel(source.commercial_use)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{source.recommended_use}</p>
              {source.url.startsWith("http") ? (
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal">
                  来源
                  <ExternalLink size={12} aria-hidden />
                </span>
              ) : null}
            </a>
          ))}
        </div>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const source = sourceById.get(item.source_dataset_id);
          return (
            <article key={item.id} className="panel min-w-0 overflow-hidden">
              <div className="aspect-[4/3] border-b border-line bg-field">
                <Preview item={item} />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-black uppercase text-teal">
                      <SourceIcon type={item.dataset_type} />
                      <span>{typeLabel(item.dataset_type)}</span>
                    </p>
                    <h2 className="mt-1 min-h-12 text-lg font-black leading-6 text-ink">{item.title}</h2>
                  </div>
                  <span className="shrink-0 rounded-[8px] bg-ink px-2 py-1 text-xs font-black text-white">
                    {Math.round(item.match_score)}
                  </span>
                </div>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-700">{item.summary}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Object.entries(item.metrics)
                    .slice(0, 4)
                    .map(([key, value]) => (
                      <div key={key} className="min-w-0 rounded-[8px] bg-field px-3 py-2">
                        <p className="truncate text-[11px] font-bold uppercase text-slate-500">{formatMetricKey(key)}</p>
                        <p className="mt-1 truncate text-sm font-black text-ink">{value ?? "-"}</p>
                      </div>
                    ))}
                </div>
                <div className="mt-3 flex min-h-14 flex-wrap content-start gap-1.5">
                  {item.tags.slice(0, 6).map((tag) => (
                    <span key={tag} className="rounded-[8px] bg-teal/10 px-2 py-1 text-[11px] font-bold text-teal">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <span className={`min-w-0 truncate rounded-[8px] px-2 py-1 text-[11px] font-black ${licenseTone(item.commercial_use)}`} title={item.license}>
                    {source ? commercialLabel(source.commercial_use) : commercialLabel(item.commercial_use)}
                  </span>
                  <a
                    href={item.source_url.startsWith("http") ? item.source_url : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="icon-button min-h-9 shrink-0 border border-line bg-white px-3 py-2 text-xs text-ink"
                  >
                    <ExternalLink size={13} aria-hidden />
                    <span>源</span>
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {!items.length && !busy ? <div className="empty-state mt-4 text-sm font-semibold text-slate-500">暂无匹配数据。</div> : null}
    </Shell>
  );
}
