"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuGroup } from "@/lib/menuMatrix";

export interface MatrixPoint {
  key: string;
  name: string;
  group: MenuGroup;
  sold: number;
  perItem: number;
  /** As the reader reads them ("120 sold", "1,250 IQD"). */
  soldText: string;
  perItemText: string;
}

/** Each group's colour (the charts' fixed order) and shape: never colour alone. */
const MARK: Record<
  MenuGroup,
  { color: string; shape: "circle" | "square" | "triangle" | "diamond" }
> = {
  keep: { color: "var(--viz-1)", shape: "circle" },
  raise: { color: "var(--viz-2)", shape: "square" },
  promote: { color: "var(--viz-3)", shape: "triangle" },
  rethink: { color: "var(--viz-4)", shape: "diamond" },
};

/** The nearest round step above a value: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(span: number, ticks: number): number {
  const raw = span / ticks;
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

const PAD = { left: 64, right: 16, top: 16, bottom: 44 };

export function Mark({ group, size = 10 }: { group: MenuGroup; size?: number }) {
  const { color, shape } = MARK[group];
  const r = size / 2;
  return (
    <svg
      width={size + 4}
      height={size + 4}
      viewBox={`${-r - 2} ${-r - 2} ${size + 4} ${size + 4}`}
      aria-hidden="true"
    >
      <Shape shape={shape} color={color} r={r} />
    </svg>
  );
}

function Shape({
  shape,
  color,
  r,
  x = 0,
  y = 0,
}: {
  shape: "circle" | "square" | "triangle" | "diamond";
  color: string;
  r: number;
  x?: number;
  y?: number;
}) {
  // A 2px ring of the card's colour keeps marks that overlap apart.
  const ring = { fill: color, stroke: "var(--surface)", strokeWidth: 2 };
  if (shape === "circle") return <circle cx={x} cy={y} r={r} {...ring} />;
  if (shape === "square")
    return (
      <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx={2} {...ring} />
    );
  if (shape === "triangle")
    return (
      <polygon
        points={`${x},${y - r * 1.1} ${x + r * 1.05},${y + r * 0.8} ${x - r * 1.05},${y + r * 0.8}`}
        {...ring}
      />
    );
  return (
    <polygon
      points={`${x},${y - r * 1.2} ${x + r * 1.2},${y} ${x},${y + r * 1.2} ${x - r * 1.2},${y}`}
      {...ring}
    />
  );
}

/**
 * The menu matrix as a picture (round eleven): a mark for each product, as far
 * right as it sells and as high as it earns on each one; the two lines are
 * "sells a lot" and the menu's average earning, and the four corners are the
 * groups. Each group has its colour and its shape; the pointer (or a tap)
 * names a mark, and the lists under the chart hold every figure, so nothing
 * is read from colour or the pointer alone.
 */
export function MenuMatrixChart({
  points,
  popular,
  average,
  labels,
}: {
  points: MatrixPoint[];
  popular: number;
  average: number;
  labels: {
    title: string;
    x: string;
    y: string;
    groups: Record<MenuGroup, string>;
    sellsALot: string;
    average: string;
  };
}) {
  const [active, setActive] = useState<string | null>(null);
  // Drawn at the width it is shown at, so its words stay the size of the page's.
  const frame = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => setW(Math.max(280, Math.round(el.clientWidth)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(360, Math.max(260, W * 0.5)));
  const maxX = Math.max(popular * 2, ...points.map((p) => p.sold), 1);
  const ys = points.map((p) => p.perItem);
  const loY = Math.min(0, ...ys);
  const hiY = Math.max(average * 2, ...ys, 1);
  const xStep = niceStep(maxX, 4);
  const yStep = niceStep(hiY - loY, 4);
  const xTop = Math.ceil(maxX / xStep) * xStep;
  const yBottom = Math.floor(loY / yStep) * yStep;
  const yTop = Math.ceil(hiY / yStep) * yStep;
  const px = (v: number) => PAD.left + (v / xTop) * (W - PAD.left - PAD.right);
  const py = (v: number) =>
    H - PAD.bottom - ((v - yBottom) / (yTop - yBottom)) * (H - PAD.top - PAD.bottom);
  const xTicks = Array.from({ length: Math.round(xTop / xStep) + 1 }, (_, i) => i * xStep);
  const yTicks = Array.from(
    { length: Math.round((yTop - yBottom) / yStep) + 1 },
    (_, i) => yBottom + i * yStep,
  );
  const shown = points.find((p) => p.key === active) ?? null;
  const corner = (group: MenuGroup, x: number, y: number, anchor: "start" | "end") => (
    <text x={x} y={y} textAnchor={anchor} className="mm-corner">
      {labels.groups[group]}
    </text>
  );

  return (
    <figure className="viz mm-viz" data-testid="menu-matrix-chart">
      <figcaption className="viz-head">
        <span className="viz-title">{labels.title}</span>
        <span className="viz-legend">
          {(["keep", "raise", "promote", "rethink"] as const).map((g) => (
            <span key={g} className="viz-key">
              <Mark group={g} />
              {labels.groups[g]}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="mm-frame" ref={frame}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mm-svg"
          role="img"
          aria-label={labels.title}
          onMouseLeave={() => setActive(null)}
        >
          {xTicks.map((v) => (
            <g key={`x${v}`}>
              <line x1={px(v)} x2={px(v)} y1={PAD.top} y2={H - PAD.bottom} className="mm-grid" />
              <text x={px(v)} y={H - PAD.bottom + 16} textAnchor="middle" className="mm-tick">
                {v.toLocaleString("en-US")}
              </text>
            </g>
          ))}
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={PAD.left} x2={W - PAD.right} y1={py(v)} y2={py(v)} className="mm-grid" />
              <text x={PAD.left - 8} y={py(v) + 4} textAnchor="end" className="mm-tick">
                {v.toLocaleString("en-US")}
              </text>
            </g>
          ))}
          <text x={(W + PAD.left) / 2} y={H - 4} textAnchor="middle" className="mm-axis">
            {labels.x}
          </text>
          <text
            x={14}
            y={(H - PAD.bottom + PAD.top) / 2}
            textAnchor="middle"
            className="mm-axis"
            transform={`rotate(-90 14 ${(H - PAD.bottom + PAD.top) / 2})`}
          >
            {labels.y}
          </text>
          {/* The two lines the groups are cut by. */}
          <line
            x1={px(popular)}
            x2={px(popular)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            className="mm-cut"
          >
            <title>{labels.sellsALot}</title>
          </line>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={py(average)}
            y2={py(average)}
            className="mm-cut"
          >
            <title>{labels.average}</title>
          </line>
          {corner("promote", PAD.left + 8, PAD.top + 14, "start")}
          {corner("keep", W - PAD.right - 8, PAD.top + 14, "end")}
          {corner("rethink", PAD.left + 8, H - PAD.bottom - 8, "start")}
          {corner("raise", W - PAD.right - 8, H - PAD.bottom - 8, "end")}
          {points.map((p) => (
            <g
              key={p.key}
              className={active === p.key ? "mm-point on" : "mm-point"}
              data-testid="matrix-point"
              data-group={p.group}
              onMouseEnter={() => setActive(p.key)}
              onClick={() => setActive(active === p.key ? null : p.key)}
            >
              {/* A target bigger than the mark. */}
              <circle cx={px(p.sold)} cy={py(p.perItem)} r={14} fill="transparent" />
              <Shape
                shape={MARK[p.group].shape}
                color={MARK[p.group].color}
                r={6}
                x={px(p.sold)}
                y={py(p.perItem)}
              />
            </g>
          ))}
        </svg>
        {shown && (
          <div
            className="viz-tip mm-tip"
            role="status"
            style={{
              left: `${(px(shown.sold) / W) * 100}%`,
              top: `${(py(shown.perItem) / H) * 100}%`,
            }}
          >
            <strong>{shown.name}</strong>
            <span>{labels.groups[shown.group]}</span>
            <span>
              {shown.soldText} · {shown.perItemText}
            </span>
          </div>
        )}
      </div>
    </figure>
  );
}
