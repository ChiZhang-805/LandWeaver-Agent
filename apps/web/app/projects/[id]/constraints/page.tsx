"use client";

import { ArrowRight, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Field } from "@/components/Field";
import { Shell } from "@/components/Shell";
import { getProject, saveConstraints } from "@/lib/api";
import type { ConstraintSet } from "@/lib/types";

const initial: ConstraintSet = {
  far_max: 2.5,
  building_density_max: 0.28,
  green_ratio_min: 0.3,
  height_limit_m: 80,
  setbacks_m: { north: 10, south: 10, east: 8, west: 8 },
  min_spacing_m: 18,
  parking_ratio_per_unit: 1.1,
  saleable_ratio: 0.82,
  assumptions: {
    avg_selling_price_cny_per_m2: 32000,
    hard_cost_cny_per_m2: 5200,
    land_cost_cny: 120000000,
    soft_cost_ratio: 0.12,
    tax_ratio: 0.09,
    marketing_ratio: 0.03
  }
};

export default function ConstraintsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getProject(projectId)
      .then((aggregate) => {
        if (aggregate.constraints) setForm(aggregate.constraints);
      })
      .catch(() => undefined);
  }, [projectId]);

  function update(path: string, value: string) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      setStatus("请输入有效数字");
      return;
    }
    setForm((current) => {
      const next = structuredClone(current);
      const keys = path.split(".");
      let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
      target[keys[keys.length - 1]] = number;
      return next;
    });
    setStatus("");
  }

  async function submit() {
    try {
      await saveConstraints(projectId, form);
      setStatus("已保存约束");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "保存失败");
    }
  }

  return (
    <Shell projectId={projectId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">CONSTRAINTS</p>
          <h1 className="page-title mt-2">规划与经济约束</h1>
          <p className="page-copy mt-2">强排边界、指标上限和收益假设。</p>
        </div>
        <div className="flex gap-2">
          <button title="保存约束" className="icon-button bg-teal text-white" onClick={submit}>
            <Save size={16} aria-hidden />
            <span>保存</span>
          </button>
          <Link className="icon-button border border-line bg-white" href={`/projects/${projectId}/prototypes`}>
            <ArrowRight size={16} aria-hidden />
            <span>下一步</span>
          </Link>
        </div>
      </div>
      <div className="grid gap-4">
        <div className="panel p-5">
          <h2 className="section-title">规划控制</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="FAR 上限" value={form.far_max} onChange={(value) => update("far_max", value)} />
            <Field label="建筑密度上限" value={form.building_density_max} onChange={(value) => update("building_density_max", value)} />
            <Field label="绿地率下限" value={form.green_ratio_min} onChange={(value) => update("green_ratio_min", value)} />
            <Field label="限高 m" value={form.height_limit_m} onChange={(value) => update("height_limit_m", value)} />
            <Field label="楼间距 m" value={form.min_spacing_m} onChange={(value) => update("min_spacing_m", value)} />
            <Field label="可售比" value={form.saleable_ratio} onChange={(value) => update("saleable_ratio", value)} />
            <Field label="车位/户" value={form.parking_ratio_per_unit} onChange={(value) => update("parking_ratio_per_unit", value)} />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="panel p-5">
            <h2 className="section-title">四向退界</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="北退界 m" value={form.setbacks_m.north} onChange={(value) => update("setbacks_m.north", value)} />
              <Field label="南退界 m" value={form.setbacks_m.south} onChange={(value) => update("setbacks_m.south", value)} />
              <Field label="东退界 m" value={form.setbacks_m.east} onChange={(value) => update("setbacks_m.east", value)} />
              <Field label="西退界 m" value={form.setbacks_m.west} onChange={(value) => update("setbacks_m.west", value)} />
            </div>
          </div>
          <div className="panel p-5">
            <h2 className="section-title">经济假设</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="售价 元/m2" value={form.assumptions.avg_selling_price_cny_per_m2} onChange={(value) => update("assumptions.avg_selling_price_cny_per_m2", value)} />
              <Field label="建安 元/m2" value={form.assumptions.hard_cost_cny_per_m2} onChange={(value) => update("assumptions.hard_cost_cny_per_m2", value)} />
              <Field label="地价 元" value={form.assumptions.land_cost_cny} onChange={(value) => update("assumptions.land_cost_cny", value)} />
              <Field label="软成本率" value={form.assumptions.soft_cost_ratio} onChange={(value) => update("assumptions.soft_cost_ratio", value)} />
              <Field label="税费率" value={form.assumptions.tax_ratio} onChange={(value) => update("assumptions.tax_ratio", value)} />
              <Field label="营销费率" value={form.assumptions.marketing_ratio} onChange={(value) => update("assumptions.marketing_ratio", value)} />
            </div>
          </div>
        </div>
      </div>
      {status ? <p className={`mt-3 status-message ${status.includes("失败") ? "danger-message" : ""}`}>{status}</p> : null}
    </Shell>
  );
}
