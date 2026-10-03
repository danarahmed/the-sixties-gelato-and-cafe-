export interface Share {
  key: string;
  label: string;
  /** Its size: a share of the whole (per 1,000, a percentage, an amount). */
  value: number;
  /** As the reader reads it, beside its name ("380 IQD"). */
  valueText: string;
  /** Quieter, after it ("38,000 IQD over the period"). */
  sub?: string;
}

/**
 * One whole split into its parts, side by side in one bar, each in its own
 * colour in a fixed order, a hairline of the surface between them; under it
 * the parts named with their values, so the list is the legend and the table
 * at once and nothing is read from colour alone.
 */
export function ShareBar({ parts, label }: { parts: Share[]; label: string }) {
  const drawn = parts.filter((p) => p.value > 0);
  const total = drawn.reduce((s, p) => s + p.value, 0);
  return (
    <div className="sharebar">
      {total > 0 && (
        <div className="sharebar-track" aria-hidden="true">
          {drawn.map((p) => (
            <span
              key={p.key}
              className={`sharebar-part share-${parts.indexOf(p)}`}
              style={{ flexGrow: p.value / total }}
            />
          ))}
        </div>
      )}
      <ul className="sharebar-keys" aria-label={label}>
        {parts.map((p, i) => (
          <li key={p.key} className="sharebar-key">
            <span className={`sharebar-swatch share-${i}`} aria-hidden="true" />
            <span className="sharebar-name">{p.label}</span>
            <span className="sharebar-value">{p.valueText}</span>
            {p.sub && <span className="sharebar-sub">{p.sub}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
