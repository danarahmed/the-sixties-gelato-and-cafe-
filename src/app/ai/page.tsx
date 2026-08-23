import { getT } from "@/lib/i18n/server";

interface Insight {
  kind: string;
  title: string;
  recommendation: string;
  explanation: string;
  dataUsed: string;
  confidence: number;
  horizon: string;
  impact: string;
  action: string;
}

const SAMPLE_INSIGHTS: Insight[] = [
  {
    kind: "Production plan",
    title: "Produce 6.0 kg pistachio gelato tomorrow",
    recommendation: "Make ~6,000 g pistachio gelato for tomorrow.",
    explanation:
      "Forecast demand 5.2 kg + minimum display 1.0 kg − usable stock 1.73 kg, allowing for ~8% expected waste.",
    dataUsed: "Last 14 days sales by hour, current usable stock, expiry dates, display minimum.",
    confidence: 0.78,
    horizon: "Tomorrow",
    impact: "Avoids ~1.4 kg stockout risk; keeps display full at peak.",
    action: "Create production batch",
  },
  {
    kind: "Reorder suggestion",
    title: "Delivery bags below reorder point",
    recommendation: "Order 2 cartons of delivery bags from City Packaging.",
    explanation: "On-hand 420 < reorder 500; delivery orders trending up 12% week-on-week.",
    dataUsed: "Movement ledger, supplier lead time, delivery-channel order trend.",
    confidence: 0.83,
    horizon: "3 days",
    impact: "Prevents inability to fulfil delivery packaging mid-week.",
    action: "Create purchase order",
  },
  {
    kind: "Discount anomaly",
    title: "A Talabat promotion is losing money",
    recommendation: "Review the 'Vanilla Latte 20% off' Talabat promo.",
    explanation:
      "On Talabat this item's contribution is negative after commission + packaging; merchant-funded share is too high.",
    dataUsed: "Platform order economics, recipe cost, settlement fees.",
    confidence: 0.71,
    horizon: "Last 7 days",
    impact: "Est. −38,000 IQD/week if it continues.",
    action: "Adjust promotion",
  },
  {
    kind: "Fraud watch",
    title: "Unusual void pattern on one shift",
    recommendation: "Review voids on the Thursday evening shift.",
    explanation: "Void rate 4.1× the branch average, clustered near close, same operator.",
    dataUsed: "Sale adjustments (voids/refunds), shift assignment, audit log.",
    confidence: 0.64,
    horizon: "Last 30 days",
    impact: "Possible shrinkage; needs human review.",
    action: "Open audit trail",
  },
];

export default async function AiPage() {
  const t = await getT();
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">
        ⚠️ Example insights — no AI provider key is configured, so these are illustrations of the
        format. The core POS/inventory/accounting works fully without AI.
      </div>
      <h1 style={{ margin: 0 }}>{t("nav.ai")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        AI only explains, forecasts, and <strong>recommends</strong>. It never changes money or
        stock. All money/inventory math stays deterministic in app code. Human approval is required
        before creating a PO, changing a price or recipe, adjusting inventory, posting a journal,
        publishing a promotion, or contacting a supplier — and every AI call is audited.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))" }}>
        {SAMPLE_INSIGHTS.map((s) => (
          <div
            key={s.title}
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span className="badge">{s.kind}</span>
            <h3 style={{ margin: "4px 0" }}>{s.title}</h3>
            <p style={{ margin: 0 }}>{s.recommendation}</p>
            <p className="muted" style={{ fontSize: ".85rem", margin: 0 }}>
              {s.explanation}
            </p>
            <div
              style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: ".8rem" }}
              className="muted"
            >
              <span>
                Confidence <strong>{Math.round(s.confidence * 100)}%</strong>
              </span>
              <span>
                Horizon <strong>{s.horizon}</strong>
              </span>
            </div>
            <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
              <strong>Data used:</strong> {s.dataUsed}
            </p>
            <p style={{ fontSize: ".85rem", margin: 0 }}>
              <strong>Impact:</strong> {s.impact}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button className="btn-primary" disabled title="Requires an AI key + human approval">
                ✓ {s.action}
              </button>
              <button disabled>Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
