import { getT } from "@/lib/i18n/server";

/**
 * Honest placeholder for modules whose backend/domain logic exists (schema +
 * tested calculations) but whose full UI is scheduled in a later phase. It
 * states plainly what is done and what remains — never implies completeness.
 */
export async function ModulePlaceholder({
  titleKey,
  phase,
  done,
  planned,
}: {
  titleKey: string;
  phase: string;
  done: string[];
  planned: string[];
}) {
  const t = await getT();
  return (
    <div className="grid" style={{ gap: 16, maxWidth: 820 }}>
      <h1 style={{ margin: 0 }}>{t(titleKey)}</h1>
      <span className="badge">{phase}</span>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>✅ Foundation in place</h3>
        <ul>
          {done.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <h3>🛠️ UI scheduled next</h3>
        <ul>
          {planned.map((p) => (
            <li key={p} className="muted">
              {p}
            </li>
          ))}
        </ul>
      </div>
      <p className="muted" style={{ fontSize: ".9rem" }}>
        See <code>docs/ROADMAP.md</code> and <code>docs/PROGRESS.md</code> for the full status of
        this module.
      </p>
    </div>
  );
}
