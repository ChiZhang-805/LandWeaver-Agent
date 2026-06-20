function formatMetric(value: unknown) {
  if (typeof value !== "number") return String(value ?? "-");
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  if (Math.abs(value) > 0 && Math.abs(value) < 1) return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

const labels: Record<string, string> = {
  total_gfa_m2: "总建面",
  saleable_area_m2: "可售面积",
  revenue_cny: "货值",
  total_cost_cny: "总成本",
  gross_margin_cny: "毛利",
  gross_margin_ratio: "毛利率",
  far: "容积率",
  building_density: "建筑密度",
  building_count: "楼栋数",
  units: "户数"
};

const accents = ["border-teal/25 bg-teal/5", "border-blue-500/20 bg-blue-50/70", "border-amber/25 bg-amber/5", "border-slate-300 bg-white"];

export function MetricGrid({ metrics, compact = false, className = "" }: { metrics: Record<string, unknown>; compact?: boolean; className?: string }) {
  const keys = ["far", "building_density", "total_gfa_m2", "units", "revenue_cny", "total_cost_cny", "gross_margin_cny", "gross_margin_ratio"];
  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {keys.map((key, index) => (
        <div key={key} className={`rounded-[8px] border ${compact ? "p-3" : "p-4"} shadow-[0_10px_28px_rgba(23,32,42,0.045)] ${accents[index % accents.length]}`}>
          <div className="text-xs font-bold text-slate-500">{labels[key] || key}</div>
          <div className={`${compact ? "mt-1 text-lg" : "mt-2 text-xl"} font-black text-ink`}>{formatMetric(metrics[key])}</div>
        </div>
      ))}
    </div>
  );
}
