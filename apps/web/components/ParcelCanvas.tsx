"use client";

import { Eraser, SquareMousePointer } from "lucide-react";
import type { Coordinate } from "@/lib/types";

function pointsToString(points: Coordinate[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function canvasBounds(points: Coordinate[]) {
  if (!points.length) return { minX: -15, minY: -15, width: 150, height: 110 };
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(30, maxX - minX);
  const height = Math.max(30, maxY - minY);
  const padding = Math.max(width, height) * 0.12;
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: width + padding * 2,
    height: height + padding * 2
  };
}

export function ParcelCanvas({
  points,
  onChange,
  className = ""
}: {
  points: Coordinate[];
  onChange: (points: Coordinate[]) => void;
  className?: string;
}) {
  function handleClick(event: React.MouseEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;

    const cursor = svg.createSVGPoint();
    cursor.x = event.clientX;
    cursor.y = event.clientY;
    const { x, y } = cursor.matrixTransform(matrix.inverse());

    onChange([...points, [Number(x.toFixed(1)), Number(y.toFixed(1))]]);
  }

  const viewBox = canvasBounds(points);
  const gridSize = Math.max(10, Math.round(Math.max(viewBox.width, viewBox.height) / 12));

  return (
    <div className={`panel flex min-h-[360px] flex-col overflow-hidden ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-field/70 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-ink">
          <SquareMousePointer size={18} aria-hidden />
          <span>地块画布</span>
        </div>
        <button title="清空" className="icon-button border border-line bg-white" onClick={() => onChange([])}>
          <Eraser size={16} aria-hidden />
        </button>
      </div>
      <svg
        className="block min-h-0 w-full flex-1 cursor-crosshair bg-white"
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        onClick={handleClick}
        role="img"
      >
        <defs>
          <pattern id="parcel-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#e7ebf0" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect x={viewBox.minX} y={viewBox.minY} width={viewBox.width} height={viewBox.height} fill="url(#parcel-grid)" />
        {points.length >= 2 ? <polyline points={pointsToString(points)} fill="none" stroke="#0f766e" strokeWidth="1.5" /> : null}
        {points.length >= 3 ? <polygon points={pointsToString(points)} fill="#0f766e22" stroke="#0f766e" strokeWidth="1.8" /> : null}
        {points.map(([x, y], index) => (
          <g key={`${x}-${y}-${index}`}>
            <circle cx={x} cy={y} r="2.2" fill="#17202a" />
            <text x={x + 2.8} y={y - 2.8} fontSize="4" fill="#17202a">
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
