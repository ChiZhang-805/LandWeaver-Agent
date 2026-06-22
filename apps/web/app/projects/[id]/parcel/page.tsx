"use client";

import { ArrowRight, FileUp, GripVertical, Plus, Save, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ParcelCanvas } from "@/components/ParcelCanvas";
import { Shell } from "@/components/Shell";
import { getProject, saveParcel } from "@/lib/api";
import type { Coordinate } from "@/lib/types";

const sample: Coordinate[] = [
  [0, 0],
  [120, 0],
  [120, 80],
  [0, 80]
];

type ParcelSnapshot = {
  points: Coordinate[];
  geojson: unknown;
  dxfText: string;
};

type UpdateOptions = {
  recordHistory?: boolean;
};

function clonePoints(points: Coordinate[]) {
  return points.map(([x, y]) => [x, y] as Coordinate);
}

function pointsEqual(left: Coordinate[], right: Coordinate[]) {
  return left.length === right.length && left.every(([x, y], index) => x === right[index][0] && y === right[index][1]);
}

function ringFromCoordinates(coordinates: unknown): Coordinate[] {
  if (!Array.isArray(coordinates) || !Array.isArray(coordinates[0])) throw new Error("GeoJSON 坐标格式不正确");
  const ring = coordinates[0] as unknown[];
  return ring
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) throw new Error("GeoJSON 点位格式不正确");
      return [Number(point[0]), Number(point[1])] as Coordinate;
    })
    .filter((point, index, list) => index !== list.length - 1 || point[0] !== list[0][0] || point[1] !== list[0][1]);
}

function pointsFromGeojson(payload: unknown): Coordinate[] {
  const value = payload as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown[] };
  if (value.type === "Feature") return pointsFromGeojson(value.geometry);
  if (value.type === "FeatureCollection") {
    const feature = value.features?.find((item) => {
      const geometry = (item as { geometry?: { type?: string } }).geometry;
      return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
    });
    if (!feature) throw new Error("GeoJSON 中没有 Polygon");
    return pointsFromGeojson(feature);
  }
  if (value.type === "Polygon") return ringFromCoordinates(value.coordinates);
  if (value.type === "MultiPolygon") {
    const polygons = value.coordinates as unknown[];
    if (!Array.isArray(polygons) || !polygons.length) throw new Error("GeoJSON MultiPolygon 为空");
    return ringFromCoordinates(polygons[0]);
  }
  throw new Error("仅支持 Polygon / MultiPolygon GeoJSON");
}

function pairsFromDxf(text: string) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((line) => line.trim());
  const pairs: [string, string][] = [];
  for (let index = 0; index + 1 < lines.length; index += 2) pairs.push([lines[index], lines[index + 1]]);
  return pairs;
}

function pointsFromDxf(text: string): Coordinate[] {
  const pairs = pairsFromDxf(text);
  const rings: Coordinate[][] = [];
  let index = 0;
  while (index < pairs.length) {
    const [code, value] = pairs[index];
    if (code === "0" && value.toUpperCase() === "LWPOLYLINE") {
      index += 1;
      const ring: Coordinate[] = [];
      let x: number | null = null;
      while (index < pairs.length && pairs[index][0] !== "0") {
        const [group, groupValue] = pairs[index];
        if (group === "10") x = Number(groupValue);
        if (group === "20" && x !== null) {
          ring.push([x, Number(groupValue)]);
          x = null;
        }
        index += 1;
      }
      if (ring.length >= 3) rings.push(ring);
      continue;
    }
    index += 1;
  }
  if (!rings.length) throw new Error("DXF 中没有可识别的 LWPOLYLINE 红线");
  return rings[0];
}

function polygonArea(points: Coordinate[]) {
  if (points.length < 3) return 0;
  const total = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  return Math.abs(total / 2);
}

function parseCoordinate(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(3)) : null;
}

export default function ParcelPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [points, setPoints] = useState<Coordinate[]>(sample);
  const [history, setHistory] = useState<ParcelSnapshot[]>([]);
  const [geojson, setGeojson] = useState<unknown>(null);
  const [dxfText, setDxfText] = useState("");
  const [draftPoint, setDraftPoint] = useState({ x: "", y: "" });
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getProject(projectId)
      .then((aggregate) => {
        if (aggregate.parcel?.boundary?.length) {
          setPoints(clonePoints(aggregate.parcel.boundary));
          setGeojson(null);
          setDxfText("");
          setIsSaved(true);
        } else {
          setIsSaved(false);
        }
        setHistory([]);
        setStatus("");
      })
      .catch((event) => {
        setStatus(event instanceof Error ? `地块加载失败：${event.message}` : "地块加载失败");
      });
  }, [projectId]);

  function pushHistorySnapshot() {
    setHistory((current) => [...current, { points: clonePoints(points), geojson, dxfText }]);
  }

  function updatePoints(next: Coordinate[], source: { geojson?: unknown; dxfText?: string } = {}, options: UpdateOptions = {}) {
    if (pointsEqual(points, next) && source.geojson === undefined && source.dxfText === undefined) return;
    if (options.recordHistory !== false) {
      pushHistorySnapshot();
    }
    setGeojson(source.geojson ?? null);
    setDxfText(source.dxfText ?? "");
    setPoints(clonePoints(next));
    setIsSaved(false);
  }

  function updateCanvasPoints(next: Coordinate[], options: UpdateOptions = {}) {
    updatePoints(next, {}, options);
  }

  function undoPoints() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setPoints(clonePoints(previous.points));
    setGeojson(previous.geojson);
    setDxfText(previous.dxfText);
    setIsSaved(false);
    setStatus(history.length > 1 ? `已撤销，仍可返回 ${history.length - 1} 步` : "已返回到最初状态");
  }

  function updatePoint(index: number, axis: 0 | 1, value: string) {
    const number = parseCoordinate(value);
    if (number === null) {
      setStatus("坐标必须是数字");
      return;
    }
    updatePoints(points.map((point, pointIndex) => (pointIndex === index ? ([axis === 0 ? number : point[0], axis === 1 ? number : point[1]] as Coordinate) : point)));
    setStatus("");
  }

  function addPoint() {
    const x = parseCoordinate(draftPoint.x);
    const y = parseCoordinate(draftPoint.y);
    if (x === null || y === null) {
      setStatus("请填写有效的 X / Y 坐标");
      return;
    }
    updatePoints([...points, [x, y]]);
    setDraftPoint({ x: "", y: "" });
    setStatus(`已新增点 ${points.length + 1}`);
  }

  function removePoint(index: number) {
    updatePoints(points.filter((_, pointIndex) => pointIndex !== index));
  }

  function reorderPoint(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= points.length || toIndex >= points.length) return;
    const next = [...points];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    updatePoints(next);
    setStatus("");
  }

  function handlePointDragStart(event: React.DragEvent<HTMLButtonElement>, index: number) {
    setDraggedPointIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handlePointDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handlePointDrop(event: React.DragEvent<HTMLElement>, index: number) {
    event.preventDefault();
    const rawIndex = event.dataTransfer.getData("text/plain");
    const fromIndex = draggedPointIndex ?? Number(rawIndex);
    if (Number.isFinite(fromIndex)) reorderPoint(fromIndex, index);
    setDraggedPointIndex(null);
  }

  async function submit() {
    try {
      const parcel = await saveParcel(
        projectId,
        geojson ? { geojson, source: "geojson" } : dxfText ? { dxf_text: dxfText, source: "dxf" } : { points, source: "manual" }
      );
      setIsSaved(true);
      setStatus(`已保存 ${parcel.area_m2.toLocaleString("zh-CN")} ㎡`);
    } catch (event) {
      setIsSaved(false);
      setStatus(event instanceof Error ? event.message : "保存失败");
    }
  }

  async function importBoundary(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      const isDxf = file.name.toLowerCase().endsWith(".dxf");
      const payload = isDxf ? text : (JSON.parse(text) as unknown);
      const importedPoints = isDxf ? pointsFromDxf(text) : pointsFromGeojson(payload);
      updatePoints(importedPoints, { geojson: isDxf ? null : payload, dxfText: isDxf ? text : "" });
      setStatus(`已读取 ${file.name}`);
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "文件读取失败");
    }
  }

  return (
    <Shell projectId={projectId}>
      <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">PARCEL</p>
          <h1 className="page-title mt-2">地块红线</h1>
          <p className="page-copy mt-2">红线点位、面积和数据来源。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label title="导入 GeoJSON / DXF" className="icon-button cursor-pointer border border-line bg-white">
            <FileUp size={16} aria-hidden />
            <span>GeoJSON / DXF</span>
            <input className="hidden" type="file" accept=".geojson,.json,.dxf,application/geo+json,application/json" onChange={(event) => importBoundary(event.target.files?.[0])} />
          </label>
          <button title={history.length ? `撤销上一步，可连续返回 ${history.length} 步` : "暂无可撤销操作"} className="icon-button border border-line bg-white" disabled={!history.length} onClick={undoPoints}>
            <Undo2 size={16} aria-hidden />
          </button>
          <button title="保存地块" className="icon-button bg-teal text-white" onClick={submit}>
            <Save size={16} aria-hidden />
            <span>保存</span>
          </button>
          {isSaved ? (
            <Link className="icon-button border border-line bg-white" href={`/projects/${projectId}/brief`}>
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
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
        <ParcelCanvas className="h-full" points={points} onChange={updateCanvasPoints} onEditStart={pushHistorySnapshot} />
        <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden">
          <div className="panel p-4">
            <h2 className="section-title">红线概览</h2>
            <div className="mt-3 grid gap-3">
              <div className="rounded-[8px] border border-teal/20 bg-teal/5 p-3">
                <p className="text-xs font-bold text-slate-500">估算面积</p>
                <p className="mt-1 text-2xl font-black text-ink">{polygonArea(points).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} ㎡</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[8px] border border-line bg-white p-3">
                  <p className="text-xs font-bold text-slate-500">点位</p>
                  <p className="mt-1 text-xl font-black text-ink">{points.length}</p>
                </div>
                <div className="rounded-[8px] border border-line bg-white p-3">
                  <p className="text-xs font-bold text-slate-500">来源</p>
                  <p className="mt-1 text-xl font-black text-ink">{dxfText ? "DXF" : geojson ? "GeoJSON" : "手动"}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="panel flex min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-line bg-field/70 px-4 py-3">
              <h2 className="section-title">坐标点</h2>
              <span className="text-xs font-semibold text-slate-500">{points.length} 点</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-0">
              <div className="grid gap-3 md:hidden">
                {points.map(([x, y], index) => (
                  <div
                    key={`${x}-${y}-${index}`}
                    className={`rounded-[8px] border border-line bg-white p-3 ${draggedPointIndex === index ? "opacity-60" : ""}`}
                    onDragOver={handlePointDragOver}
                    onDrop={(event) => handlePointDrop(event, index)}
                    onDragEnd={() => setDraggedPointIndex(null)}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-black text-ink">点位 {index + 1}</span>
                      <div className="flex items-center justify-end gap-1">
                        <button title="删除点" className="icon-button size-8 min-h-0 border border-line bg-white p-0 text-rose" onClick={() => removePoint(index)}>
                          <Trash2 size={14} aria-hidden />
                        </button>
                        <button
                          title="拖拽排序"
                          className="icon-button size-8 min-h-0 cursor-grab border border-line bg-white p-0 active:cursor-grabbing"
                          draggable
                          onDragStart={(event) => handlePointDragStart(event, index)}
                          onDragEnd={() => setDraggedPointIndex(null)}
                        >
                          <GripVertical size={15} aria-hidden />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs font-bold text-slate-500">
                        X
                        <input
                          className="input-control h-9 min-h-0 w-full px-2 text-sm"
                          type="number"
                          step="0.1"
                          value={x}
                          onChange={(event) => updatePoint(index, 0, event.target.value)}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-slate-500">
                        Y
                        <input
                          className="input-control h-9 min-h-0 w-full px-2 text-sm"
                          type="number"
                          step="0.1"
                          value={y}
                          onChange={(event) => updatePoint(index, 1, event.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                ))}
                <div className="rounded-[8px] border border-teal/30 bg-teal/5 p-3">
                  <div className="mb-3 text-sm font-black text-teal">新增点位</div>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-2">
                    <input
                      className="input-control h-9 min-h-0 w-full px-2 text-sm"
                      type="number"
                      step="0.1"
                      placeholder="X"
                      value={draftPoint.x}
                      onChange={(event) => setDraftPoint((current) => ({ ...current, x: event.target.value }))}
                    />
                    <input
                      className="input-control h-9 min-h-0 w-full px-2 text-sm"
                      type="number"
                      step="0.1"
                      placeholder="Y"
                      value={draftPoint.y}
                      onChange={(event) => setDraftPoint((current) => ({ ...current, y: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") addPoint();
                      }}
                    />
                    <button title="新增点" className="icon-button size-9 min-h-0 bg-teal p-0 text-white" onClick={addPoint}>
                      <Plus size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
              <table className="data-table coordinate-table hidden w-full table-fixed md:table">
                <colgroup>
                  <col className="w-[42px]" />
                  <col />
                  <col />
                  <col className="w-[84px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>X</th>
                    <th>Y</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map(([x, y], index) => (
                    <tr
                      key={`${x}-${y}-${index}`}
                      className={draggedPointIndex === index ? "opacity-60" : ""}
                      onDragOver={handlePointDragOver}
                      onDrop={(event) => handlePointDrop(event, index)}
                      onDragEnd={() => setDraggedPointIndex(null)}
                    >
                      <td className="font-bold">{index + 1}</td>
                      <td>
                        <input
                          className="input-control h-9 min-h-0 w-full px-2 text-sm"
                          type="number"
                          step="0.1"
                          value={x}
                          onChange={(event) => updatePoint(index, 0, event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input-control h-9 min-h-0 w-full px-2 text-sm"
                          type="number"
                          step="0.1"
                          value={y}
                          onChange={(event) => updatePoint(index, 1, event.target.value)}
                        />
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button title="删除点" className="icon-button size-8 min-h-0 border border-line bg-white p-0 text-rose" onClick={() => removePoint(index)}>
                            <Trash2 size={14} aria-hidden />
                          </button>
                          <button
                            title="拖拽排序"
                            className="icon-button size-8 min-h-0 cursor-grab border border-line bg-white p-0 active:cursor-grabbing"
                            draggable
                            onDragStart={(event) => handlePointDragStart(event, index)}
                            onDragEnd={() => setDraggedPointIndex(null)}
                          >
                            <GripVertical size={15} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="font-bold text-teal">+</td>
                    <td>
                      <input
                        className="input-control h-9 min-h-0 w-full px-2 text-sm"
                        type="number"
                        step="0.1"
                        placeholder="X"
                        value={draftPoint.x}
                        onChange={(event) => setDraftPoint((current) => ({ ...current, x: event.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        className="input-control h-9 min-h-0 w-full px-2 text-sm"
                        type="number"
                        step="0.1"
                        placeholder="Y"
                        value={draftPoint.y}
                        onChange={(event) => setDraftPoint((current) => ({ ...current, y: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") addPoint();
                        }}
                      />
                    </td>
                    <td>
                      <button title="新增点" className="icon-button size-8 min-h-0 bg-teal p-0 text-white" onClick={addPoint}>
                        <Plus size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>
      {status ? <p className={`mt-3 shrink-0 status-message ${status.includes("失败") || status.includes("不正确") || status.includes("没有") ? "danger-message" : ""}`}>{status}</p> : null}
      </div>
    </Shell>
  );
}
