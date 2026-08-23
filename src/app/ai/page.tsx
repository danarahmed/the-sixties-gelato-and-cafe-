import { getT } from "@/lib/i18n/server";
import { getAiInsights } from "@/lib/db/read";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const t = await getT();
  const insights = await getAiInsights().catch(() => []);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("nav.ai")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        AI only explains, forecasts, and <strong>recommends</strong>. It never changes money or stock.
        All money/inventory math stays deterministic in app code. Human approval is required before
        creating a PO, changing a price or recipe, adjusting inventory, posting a journal, or
        publishing a promotion — and every AI call is audited (<code>ai_interaction_log</code>).
      </p>

      {insights.length === 0 ? (
        <EmptyState
          title="No AI insights yet"
          hint="Insights are written to the ai_insight table for a human to approve. Connecting an AI provider key and running the forecast/anomaly jobs is the next increment; the app runs fully without it."
        />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))" }}>
          {insights.map((s) => (
            <div key={s.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="badge">{s.kind.replace(/_/g, " ")}</span>
              <h3 style={{ margin: "4px 0" }}>{s.title}</h3>
              <p style={{ margin: 0 }}>{s.recommendation}</p>
              {s.explanation && (
                <p className="muted" style={{ fontSize: ".85rem", margin: 0 }}>{s.explanation}</p>
              )}
              <span className="badge" style={{ alignSelf: "start" }}>{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
