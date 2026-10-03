export interface BarRow {
  key: string;
  name: string;
  value: number;
  valueText: string;
  /** Under the bar, quieter ("62% kept"). */
  sub?: string;
}

/**
 * Bars along their rows, the largest first: one series, one colour, each
 * value written beside its bar, so the list is its own table.
 */
export function BarList({ rows, label }: { rows: BarRow[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="vbars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="vbar-row">
          <span className="vbar-name" dir="auto">
            {r.name}
          </span>
          <span className="vbar-value">{r.valueText}</span>
          <span className="vbar-track" aria-hidden="true">
            <span
              className="vbar-fill"
              style={{ width: `${(Math.max(r.value, 0) / max) * 100}%` }}
            />
          </span>
          {r.sub && <span className="vbar-sub">{r.sub}</span>}
        </li>
      ))}
    </ol>
  );
}
