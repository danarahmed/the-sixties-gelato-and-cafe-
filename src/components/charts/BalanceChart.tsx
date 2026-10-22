"use client";

import { useRef, useState, type KeyboardEvent } from "react";

export interface Balance {
  key: string;
  /** Under the column: a day. */
  label: string;
  value: number;
  /** The value as the reader reads it ("4,500,000 IQD"). */
  valueText: string;
  /** More about it, in the tooltip and the table ("Rent, three months"). */
  detail?: string;
}

/** The nearest round step above a value: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(span: number, ticks: number): number {
  const raw = span / ticks;
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

/**
 * A balance day by day (0093): a column from nothing up, or down when it is
 * below nothing — those in the warning colour, and named so in the tooltip
 * and the table, so nothing is read from colour alone. The pointer or the
 * keyboard (one stop; the arrows move along) shows a day; the table under it
 * holds every figure. The ticks are in millions.
 */
export function BalanceChart({
  title,
  balances,
  shortWord,
  labels,
  height = 180,
}: {
  title: string;
  balances: Balance[];
  /** Said of a day below nothing ("short"). */
  shortWord: string;
  labels: { table: string; heading: string; value: string };
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const slots = useRef<(HTMLDivElement | null)[]>([]);

  const values = balances.map((b) => b.value);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const step = niceStep(max - min || 1, 4);
  const hi = Math.max(step * Math.ceil(max / step), step);
  const lo = Math.min(step * Math.floor(min / step), 0);
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);

  function move(e: KeyboardEvent<HTMLDivElement>, i: number) {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let next = i;
    if (e.key === forward) next = Math.min(i + 1, balances.length - 1);
    else if (e.key === back) next = Math.max(i - 1, 0);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = balances.length - 1;
    else return;
    e.preventDefault();
    setFocusIndex(next);
    setActive(next);
    slots.current[next]?.focus();
  }

  const shown = active === null ? null : balances[active];
  return (
    <figure className="viz viz-sparse" style={{ ["--plot-h" as string]: `${height}px` }}>
      <figcaption className="viz-head">
        <span className="viz-title">{title}</span>
      </figcaption>
      <div className="viz-frame">
        <div className="viz-plot">
          {ticks.map((v) => (
            <div
              key={v}
              className="viz-gridline"
              style={{
                insetBlockEnd: `${y(v)}%`,
                ...(v === 0 ? { borderBlockStartColor: "var(--viz-axis)" } : null),
              }}
            >
              <span className="viz-tick">
                {(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}
              </span>
            </div>
          ))}
          <div className="viz-cols" role="list" aria-label={title}>
            {balances.map((b, i) => {
              const below = b.value < 0;
              return (
                <div
                  key={b.key}
                  ref={(el) => {
                    slots.current[i] = el;
                  }}
                  role="listitem"
                  tabIndex={i === focusIndex ? 0 : -1}
                  className={`viz-slot${active === i ? " on" : ""}`}
                  data-short={below ? "yes" : undefined}
                  aria-label={[b.label, b.valueText, below ? shortWord : null, b.detail]
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
                  <span
                    className="viz-bar"
                    style={{
                      position: "absolute",
                      insetBlockEnd: `${y(Math.min(b.value, 0))}%`,
                      height: `${Math.abs(y(b.value) - y(0))}%`,
                      background: below ? "var(--err)" : undefined,
                      borderRadius: below ? "0 0 4px 4px" : undefined,
                    }}
                  />
                </div>
              );
            })}
          </div>
          {shown && active !== null && (
            <div
              className="viz-tip"
              role="presentation"
              style={{
                insetInlineStart: `${Math.min(88, Math.max(12, ((active + 0.5) / balances.length) * 100))}%`,
              }}
            >
              <strong>{shown.valueText}</strong>
              <span>
                {shown.label}
                {shown.value < 0 ? ` · ${shortWord}` : ""}
              </span>
              {shown.detail && <span>{shown.detail}</span>}
            </div>
          )}
        </div>
        <div className="viz-xlabels" aria-hidden="true">
          {balances.map((b) => (
            <span key={b.key} className="viz-xlabel">
              {b.label}
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
                <th className="right">{labels.value}</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.key}>
                  <td>
                    {b.label}
                    {b.detail && <span className="muted"> · {b.detail}</span>}
                  </td>
                  <td className={`right money${b.value < 0 ? " warn-text" : ""}`}>
                    {b.valueText}
                    {b.value < 0 ? ` (${shortWord})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
