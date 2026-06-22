import { strategyLabel } from "@/lib/labels";
import type { Coordinate, Parcel, SiteOption } from "@/lib/types";

function ring(points?: Coordinate[]) {
  return (points || []).map(([x, y]) => `${x},${y}`).join(" ");
}

function bounds(groups: Coordinate[][]) {
  const all = groups.flat().filter(Boolean);
  if (!all.length) return "-20 -20 160 120";
  const xs = all.map(([x]) => x);
  const ys = all.map(([, y]) => y);
  const minX = Math.min(...xs) - 12;
  const minY = Math.min(...ys) - 12;
  const maxX = Math.max(...xs) + 12;
  const maxY = Math.max(...ys) + 12;
  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
}

export function OptionCanvas({
  parcel,
  option,
  className = "",
  compact = false
}: {
  parcel?: Parcel | null;
  option?: SiteOption | null;
  className?: string;
  compact?: boolean;
}) {
  const viewBox = bounds([parcel?.boundary || [], option?.buildable_envelope || [], ...(option?.buildings || []).map((building) => building.footprint)]);
  return (
    <div className={`panel flex min-h-[300px] flex-col overflow-hidden ${className}`}>
      <div className={`flex shrink-0 items-center justify-between border-b border-line bg-field/70 px-4 ${compact ? "py-2" : "py-3"}`}>
        <div>
          <h2 className="section-title">总图预览</h2>
          <p className={`${compact ? "mt-0" : "mt-1"} text-xs font-semibold text-slate-500`}>{option ? `${option.buildings.length} 栋 · ${strategyLabel(option.strategy)}` : "等待方案"}</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rose" />红线</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-teal" />退界</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber" />楼栋</span>
        </div>
      </div>
      <svg className={`${compact ? "min-h-0 flex-1" : "h-[460px]"} block w-full bg-white`} viewBox={viewBox} role="img">
        <defs>
          <pattern id="option-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e7ebf0" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#option-grid)" />
        {parcel ? <polygon points={ring(parcel.boundary)} fill="#ffffff" stroke="#be123c" strokeWidth="1.6" /> : null}
        {option?.buildable_envelope ? (
          <polygon points={ring(option.buildable_envelope)} fill="#0f766e16" stroke="#0f766e" strokeDasharray="3 2" strokeWidth="1.2" />
        ) : null}
        {option?.buildings.map((building, index) => (
          <g key={`${building.prototype_id}-${index}`}>
            <polygon points={ring(building.footprint)} fill="#b7791f55" stroke="#8a5a12" strokeWidth="1.2" />
            <text x={building.centroid[0]} y={building.centroid[1]} textAnchor="middle" dominantBaseline="middle" fontSize="4.2" fill="#17202a">
              {building.floors}层
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
