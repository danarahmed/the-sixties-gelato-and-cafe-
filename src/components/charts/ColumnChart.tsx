"use client";

import { useRef, useState, type KeyboardEvent } from "react";

export interface Column {
  key: string;
  /** Under the column: a day, an hour. */
  label: string;
  value: number;
  /** The value as the reader reads it ("45,000 IQD"). */
  valueText: string;
  /** More about it, in the tooltip and the table ("23 orders"). */
  detail?: string;
  /** The one the chart is about, in the café's raspberry; the rest are context. */
  emphasis?: boolean;
}

export interface LinePoint {
  key: string;
  value: number;
  valueText: string;
}

/** The nearest round step above a value: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(max: number, ticks: number): number {
  const raw = max / ticks;
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

/**
 * Columns, one per day or hour, the one the chart is about in raspberry and
 * the rest a quiet warm grey; a second series, if any, a line over them. The
 * pointer or the keyboard (one stop; the arrows move along) shows every
 * series at that column, and a table under the chart holds the same figures,
 * so nothing is read from colour or the pointer alone.
 */
export function ColumnChart({
  title,
  columns,
  columnsName,
  line,
  reference,
  labels,
  height = 180,
  sparse = false,
}: {
  title: string;
  columns: Column[];
  /** What the columns are, for the legend, the tooltip and the table ("Today"). */
  columnsName: string;
  line?: { name: string; points: LinePoint[] };
  /** A level to read the columns against ("Average: 45,000 IQD a day"). */
  reference?: { value: number; label: string };
  labels: { table: string; heading: string };
  height?: number;
  /** A month of columns: on a phone, a label a week, the last always among them. */
  sparse?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(Math.max(columns.length - 1, 0));
  const slots = useRef<(HTMLDivElement | null)[]>([]);

  const lineByKey = new Map(line?.points.map((p) => [p.key, p]) ?? []);
  // The level is named in the legend, not on the plot, where the columns would hide it.
  const hasReference = reference !== undefined && reference.value > 0;
  const peak = Math.max(
    0,
    ...columns.map((c) => c.value),
    ...(line?.points.map((p) => p.value) ?? []),
    reference?.value ?? 0,
  );
  const step = niceStep(peak || 1, 3);
  const top = Math.max(step * Math.ceil((peak || 1) / step), step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / top) * 100))}%`;

  function move(e: KeyboardEvent<HTMLDivElement>, i: number) {
    // The arrows go the way the reader reads: the next day is to the right in
    // English and to the left in Arabic and Kurdish.
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let next = i;
    if (e.key === forward) next = Math.min(i + 1, columns.length - 1);
    else if (e.key === back) next = Math.max(i - 1, 0);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = columns.length - 1;
    else return;
    e.preventDefault();
    setFocusIndex(next);
    setActive(next);
    slots.current[next]?.focus();
  }

  const shown = active === null ? null : columns[active];
  const shownLine = shown ? lineByKey.get(shown.key) : undefined;
  const linePoints = line
    ? columns
        .map((c, i) => {
          const p = lineByKey.get(c.key);
          return p ? { i, p } : null;
        })
        .filter((x): x is { i: number; p: LinePoint } => x !== null)
    : [];

  return (
    <figure
      className={sparse ? "viz viz-sparse" : "viz"}
      style={{ ["--plot-h" as string]: `${height}px` }}
    >
      <figcaption className="viz-head">
        <span className="viz-title">{title}</span>
        {(line || hasReference) && (
          <span className="viz-legend">
            <span className="viz-key">
              <span className="viz-swatch" aria-hidden="true" />
              {columnsName}
            </span>
            {line && (
              <span className="viz-key">
                <span className="viz-linekey" aria-hidden="true" />
                {line.name}
              </span>
            )}
            {hasReference && (
              <span className="viz-key">
                <span className="viz-refkey" aria-hidden="true" />
                {reference.label}
              </span>
            )}
          </span>
        )}
      </figcaption>
      <div className="viz-frame">
        <div className="viz-plot">
          {ticks.map((v) => (
            <div key={v} className="viz-gridline" style={{ insetBlockEnd: pct(v) }}>
              <span className="viz-tick">{Math.round(v).toLocaleString("en-US")}</span>
            </div>
          ))}
          {hasReference && (
            <div
              className="viz-ref"
              aria-hidden="true"
              style={{ insetBlockEnd: pct(reference.value) }}
            />
          )}
          <div className="viz-cols" role="list" aria-label={title}>
            {columns.map((c, i) => {
              const p = lineByKey.get(c.key);
              return (
                <div
                  key={c.key}
                  ref={(el) => {
                    slots.current[i] = el;
                  }}
                  role="listitem"
                  tabIndex={i === focusIndex ? 0 : -1}
                  className={`viz-slot${c.emphasis ? " emph" : ""}${active === i ? " on" : ""}`}
                  aria-label={[
                    c.label,
                    `${columnsName}: ${c.valueText}`,
                    c.detail,
                    p ? `${line!.name}: ${p.valueText}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => {
                    setFocusIndex(i);
                    setActive(i);
                  }}
                  onBlur={() => setActive(null)}
                  onKeyDown={(e) => move(e, i)}
                >
                  <span className="viz-bar" style={{ height: pct(c.value) }} />
                </div>
              );
            })}
          </div>
          {linePoints.length > 1 && (
            <svg
              className="viz-line"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points={linePoints
                  .map(
                    ({ i, p }) =>
                      `${((i + 0.5) / columns.length) * 100},${100 - Math.min(100, (p.value / top) * 100)}`,
                  )
                  .join(" ")}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          {linePoints.map(({ i, p }) => (
            <span
              key={p.key}
              className="viz-dot"
              aria-hidden="true"
              style={{
                insetInlineStart: `${((i + 0.5) / columns.length) * 100}%`,
                insetBlockEnd: pct(p.value),
              }}
            />
          ))}
          {shown && active !== null && (
            <div
              className="viz-tip"
              role="presentation"
              style={{
                insetInlineStart: `${Math.min(88, Math.max(12, ((active + 0.5) / columns.length) * 100))}%`,
              }}
            >
              <strong>{shown.valueText}</strong>
              <span>
                {columnsName} · {shown.label}
              </span>
              {shown.detail && <span>{shown.detail}</span>}
              {shownLine && (
                <span className="viz-tip-line">
                  <span className="viz-linekey" aria-hidden="true" />
                  <strong>{shownLine.valueText}</strong> {line!.name}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="viz-xlabels" aria-hidden="true">
          {columns.map((c) => (
            <span key={c.key} className="viz-xlabel">
              {c.label}
            </span>
          ))}
        </div>
      </div>
      <details className="viz-table">
        <summary>{labels.table}</summary>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{labels.heading}</th>
                <th className="right">{columnsName}</th>
                {line && <th className="right">{line.name}</th>}
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.key}>
                  <td>
                    {c.label}
                    {c.detail && <span className="muted"> · {c.detail}</span>}
                  </td>
                  <td className="right money">{c.valueText}</td>
                  {line && (
                    <td className="right money">{lineByKey.get(c.key)?.valueText ?? "—"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
