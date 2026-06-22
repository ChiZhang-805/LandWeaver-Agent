"use client";

import { Eraser, SquareMousePointer, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import type { Coordinate } from "@/lib/types";

type CanvasBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

const EMPTY_CANVAS_BOUNDS: CanvasBounds = { minX: -15, minY: -15, width: 150, height: 110 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function pointsToString(points: Coordinate[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function clampZoom(value: number) {
  return Number(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)).toFixed(2));
}

function canvasBounds(zoom: number): CanvasBounds {
  const width = EMPTY_CANVAS_BOUNDS.width / zoom;
  const height = EMPTY_CANVAS_BOUNDS.height / zoom;
  return {
    minX: EMPTY_CANVAS_BOUNDS.minX + (EMPTY_CANVAS_BOUNDS.width - width) / 2,
    minY: EMPTY_CANVAS_BOUNDS.minY + (EMPTY_CANVAS_BOUNDS.height - height) / 2,
    width,
    height
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
  const [zoom, setZoom] = useState(MIN_ZOOM);

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

  const viewBox = canvasBounds(zoom);
  const gridSize = Math.max(10, Math.round(Math.max(EMPTY_CANVAS_BOUNDS.width, EMPTY_CANVAS_BOUNDS.height) / 12));

  return (
    <div className={`panel flex min-h-[360px] flex-col overflow-hidden ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-field/70 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-ink">
          <SquareMousePointer size={18} aria-hidden />
          <span>地块画布</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="缩小画布"
            aria-label="缩小画布"
            className="icon-button size-10 min-h-0 border border-line bg-white p-0"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
          >
            <ZoomOut size={16} aria-hidden />
          </button>
          <button
            title="放大画布"
            aria-label="放大画布"
            className="icon-button size-10 min-h-0 border border-line bg-white p-0"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
          >
            <ZoomIn size={16} aria-hidden />
          </button>
          <button title="清空" aria-label="清空画布" className="icon-button size-10 min-h-0 border border-line bg-white p-0" onClick={() => onChange([])}>
            <Eraser size={16} aria-hidden />
          </button>
        </div>
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
