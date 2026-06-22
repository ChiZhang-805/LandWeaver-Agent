"use client";

import { ArrowRight, Blocks, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/Field";
import { Shell } from "@/components/Shell";
import { createPrototype, deletePrototype, getProject, updatePrototype } from "@/lib/api";
import type { BuildingPrototype } from "@/lib/types";

type PrototypeDraft = Omit<BuildingPrototype, "id">;

const templates: PrototypeDraft[] = [
  {
    type: "tower",
    footprint_width_m: 20,
    footprint_depth_m: 18,
    floors_min: 16,
    floors_max: 24,
    typical_floor_gfa_m2: 360,
    units_per_floor: 4,
    avg_unit_area_m2: 90,
    height_per_floor_m: 3
  },
  {
    type: "slab",
    footprint_width_m: 42,
    footprint_depth_m: 14,
    floors_min: 8,
    floors_max: 11,
    typical_floor_gfa_m2: 560,
    units_per_floor: 6,
    avg_unit_area_m2: 93,
    height_per_floor_m: 3
  },
  {
    type: "villa",
    footprint_width_m: 14,
    footprint_depth_m: 12,
    floors_min: 3,
    floors_max: 4,
    typical_floor_gfa_m2: 150,
    units_per_floor: 1,
    avg_unit_area_m2: 150,
    height_per_floor_m: 3.2
  },
  {
    type: "podium",
    footprint_width_m: 48,
    footprint_depth_m: 22,
    floors_min: 2,
    floors_max: 4,
    typical_floor_gfa_m2: 950,
    units_per_floor: 2,
    avg_unit_area_m2: 120,
    height_per_floor_m: 4.2
  }
];

const emptyDraft = templates[0];

const prototypeKeywords: Record<PrototypeDraft["type"], string[]> = {
  tower: ["tower", "高层", "塔楼", "高容积率", "改善"],
  slab: ["slab", "板楼", "洋房", "均衡", "通风"],
  villa: ["villa", "别墅", "低密", "大户型", "低风险"],
  podium: ["podium", "裙房", "底商", "配套", "商业"]
};

export default function PrototypesPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [items, setItems] = useState<BuildingPrototype[]>([]);
  const [draft, setDraft] = useState<PrototypeDraft>(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    getProject(projectId)
      .then((aggregate) => setItems(aggregate.prototypes))
      .catch(() => undefined);
  }, [projectId]);

  function updateDraft(key: keyof PrototypeDraft, value: string) {
    const cleaned = value.trim();
    if (key !== "type" && (!cleaned || !Number.isFinite(Number(cleaned)))) {
      setStatus("请输入有效数字");
      return;
    }
    const nextValue = key === "type" ? value : Number(cleaned);
    const nextDraft = {
      ...draft,
      [key]: nextValue
    } as PrototypeDraft;
    if (nextDraft.floors_max < nextDraft.floors_min) {
      setStatus("最高层数不能小于最低层数");
      return;
    }
    setDraft((current) => ({
      ...current,
      [key]: nextValue
    }) as PrototypeDraft);
    setStatus("");
  }

  async function add(payload: PrototypeDraft) {
    const prototype = await createPrototype(projectId, payload);
    setItems((current) => [...current, prototype]);
    setStatus(`已创建 ${prototype.type}`);
  }

  async function addDefaults() {
    try {
      const existingTypes = new Set(items.map((item) => item.type));
      const missing = [templates[0], templates[1]].filter((template) => !existingTypes.has(template.type));
      if (!missing.length) {
        setStatus("tower / slab 已存在，无需重复创建");
        return;
      }
      const created = await Promise.all(missing.map((template) => createPrototype(projectId, template)));
      setItems((current) => [...current, ...created]);
      setStatus(`已创建 ${created.map((item) => item.type).join(" / ")}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "创建失败");
    }
  }

  async function submitDraft() {
    try {
      if (editingId) {
        const updated = await updatePrototype(projectId, editingId, draft);
        setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setEditingId("");
        setStatus(`已更新 ${updated.type}`);
      } else {
        await add(draft);
      }
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "保存失败");
    }
  }

  async function remove(item: BuildingPrototype) {
    try {
      await deletePrototype(projectId, item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      if (editingId === item.id) setEditingId("");
      setStatus(`已删除 ${item.type}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "删除失败");
    }
  }

  function edit(item: BuildingPrototype) {
    setDraft({
      type: item.type,
      footprint_width_m: item.footprint_width_m,
      footprint_depth_m: item.footprint_depth_m,
      floors_min: item.floors_min,
      floors_max: item.floors_max,
      typical_floor_gfa_m2: item.typical_floor_gfa_m2,
      units_per_floor: item.units_per_floor,
      avg_unit_area_m2: item.avg_unit_area_m2,
      height_per_floor_m: item.height_per_floor_m
    });
    setEditingId(item.id);
  }

  const filteredTemplates = templates.filter((prototype) => {
    const query = templateQuery.trim().toLowerCase();
    if (!query) return true;
    const keywords = prototypeKeywords[prototype.type].join(" ").toLowerCase();
    return `${prototype.type} ${keywords}`.includes(query);
  });

  return (
    <Shell projectId={projectId}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-kicker">PROTOTYPES</p>
            <h1 className="page-title mt-2">楼栋产品原型</h1>
            <p className="page-copy mt-2">候选楼型、层数、标准层和户型效率。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button title="创建默认组合" className="icon-button bg-teal text-white" onClick={addDefaults}>
              <Plus size={16} aria-hidden />
              <span>tower + slab</span>
            </button>
            <Link className="icon-button border border-line bg-white" href={`/projects/${projectId}/generate`}>
              <ArrowRight size={16} aria-hidden />
              <span>下一步</span>
            </Link>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="min-h-0 overflow-y-auto overflow-x-hidden pr-1">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="panel flex items-center gap-3 p-4 md:col-span-2">
                  <Search size={16} className="shrink-0 text-slate-500" aria-hidden />
                  <input
                    className="min-h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                    value={templateQuery}
                    onChange={(event) => setTemplateQuery(event.target.value)}
                    placeholder="搜索：高层、板楼、低密、底商..."
                  />
                </label>
                {filteredTemplates.map((prototype) => (
                  <div key={prototype.type} className="panel p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-[8px] bg-field">
                          <Blocks size={18} aria-hidden />
                        </span>
                        <div>
                          <h2 className="font-bold">{prototype.type}</h2>
                          <p className="text-sm text-slate-600">
                            {prototype.footprint_width_m}m x {prototype.footprint_depth_m}m / {prototype.floors_min}-{prototype.floors_max}F
                          </p>
                        </div>
                      </div>
                      <button title={`创建 ${prototype.type}`} className="icon-button border border-line bg-white" onClick={() => add(prototype)}>
                        <Plus size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
                {!filteredTemplates.length ? (
                  <div className="empty-state md:col-span-2">
                    <p className="font-bold text-ink">没有匹配的原型</p>
                  </div>
                ) : null}
              </div>
              <div className="panel p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="section-title">{editingId ? "编辑原型" : "自定义原型"}</h2>
                  {editingId ? (
                    <button title="取消编辑" className="icon-button border border-line bg-white" onClick={() => setEditingId("")}>
                      <X size={16} aria-hidden />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    <span className="text-xs font-bold text-slate-500">类型</span>
                    <select className="input-control" value={draft.type} onChange={(event) => updateDraft("type", event.target.value)}>
                      <option value="tower">tower</option>
                      <option value="slab">slab</option>
                      <option value="villa">villa</option>
                      <option value="podium">podium</option>
                    </select>
                  </label>
                  <Field label="面宽 m" value={draft.footprint_width_m} onChange={(value) => updateDraft("footprint_width_m", value)} />
                  <Field label="进深 m" value={draft.footprint_depth_m} onChange={(value) => updateDraft("footprint_depth_m", value)} />
                  <Field label="最低层数" value={draft.floors_min} step="1" onChange={(value) => updateDraft("floors_min", value)} />
                  <Field label="最高层数" value={draft.floors_max} step="1" onChange={(value) => updateDraft("floors_max", value)} />
                  <Field label="标准层 m2" value={draft.typical_floor_gfa_m2} onChange={(value) => updateDraft("typical_floor_gfa_m2", value)} />
                  <Field label="户/层" value={draft.units_per_floor} step="1" onChange={(value) => updateDraft("units_per_floor", value)} />
                  <Field label="套均面积 m2" value={draft.avg_unit_area_m2} onChange={(value) => updateDraft("avg_unit_area_m2", value)} />
                  <Field label="层高 m" value={draft.height_per_floor_m} onChange={(value) => updateDraft("height_per_floor_m", value)} />
                </div>
                <button title={editingId ? "更新原型" : "创建原型"} className="icon-button mt-4 bg-teal text-white" onClick={submitDraft}>
                  <Plus size={16} aria-hidden />
                  <span>{editingId ? "更新" : "创建"}</span>
                </button>
              </div>
            </div>
          </div>
          <div className="panel min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <table className="data-table w-full table-fixed">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>尺寸</th>
                    <th>层数</th>
                    <th>标准层</th>
                    <th>户/层</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? (
                    items.map((item) => (
                      <tr key={item.id} className="border-t border-line">
                        <td className="font-semibold">{item.type}</td>
                        <td>{item.footprint_width_m} x {item.footprint_depth_m}m</td>
                        <td>{item.floors_min}-{item.floors_max}</td>
                        <td>{item.typical_floor_gfa_m2} m2</td>
                        <td>{item.units_per_floor}</td>
                        <td>
                          <div className="flex gap-2">
                            <button title="编辑" className="icon-button border border-line bg-white" onClick={() => edit(item)}>
                              <Pencil size={15} aria-hidden />
                            </button>
                            <button title="删除" className="icon-button border border-line bg-white text-rose" onClick={() => remove(item)}>
                              <Trash2 size={15} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6" colSpan={6}>
                        <div className="empty-state">
                          <p className="font-bold text-ink">暂无原型</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {status ? <p className={`mt-3 shrink-0 status-message ${status.includes("失败") ? "danger-message" : ""}`}>{status}</p> : null}
      </div>
    </Shell>
  );
}
