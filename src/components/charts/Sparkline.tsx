/**
 * The days before today at a glance, under a figure: a quiet line, its last
 * point marked. Whole days only, so the line never dips at its end for a day
 * that is not over. It only echoes what the figure and the chart below it say
 * in words and numbers, so a screen reader passes over it.
 */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const y = (v: number) => 92 - ((v - min) / span) * 84;
  const x = (i: number) => (i / (values.length - 1)) * 100;
  const last = values[values.length - 1]!;
  return (
    <span className="spark" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="spark-dot" style={{ insetBlockEnd: `${100 - y(last)}%` }} />
    </span>
  );
}
