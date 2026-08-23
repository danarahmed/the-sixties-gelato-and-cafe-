import { getT } from "@/lib/i18n/server";

/**
 * Owner dashboard. The figures below are DEMONSTRATION values drawn from the
 * seed data narrative; in the connected app they are computed from the ledger
 * and sales tables. They are clearly labelled as examples.
 */
export default async function DashboardPage() {
  const t = await getT();

  const kpis: { label: string; value: string; tone?: string }[] = [
    { label: t("dash.netSales"), value: "12,500 IQD" },
    { label: t("dash.grossProfit"), value: "8,802 IQD", tone: "ok" },
    { label: t("dash.contribution"), value: "1,740 IQD", tone: "ok" },
    { label: t("dash.orders"), value: "3" },
    { label: t("dash.avgOrder"), value: "4,167 IQD" },
    { label: t("dash.platformPayout"), value: "3,650 IQD", tone: "warn" },
  ];

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("dash.title")}</h1>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
      >
        {kpis.map((k) => (
          <div key={k.label} className="card stat">
            <span className="label">{k.label}</span>
            <span className={`value ${k.tone === "ok" ? "" : ""}`}>{k.value}</span>
            {k.tone && (
              <span className={`badge ${k.tone}`}>{k.tone === "warn" ? "action" : "healthy"}</span>
            )}
          </div>
        ))}
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
      >
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("dash.lowStock")}</h3>
          <div className="deduction-row">
            <span>Delivery bag</span>
            <span className="badge warn mono">low</span>
          </div>
          <div className="deduction-row">
            <span>Cone sleeve</span>
            <span className="badge warn mono">low</span>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("dash.expiring")}</h3>
          <div className="deduction-row">
            <span>Pistachio gelato lot</span>
            <span className="badge mono">2026-08-20</span>
          </div>
          <div className="deduction-row">
            <span>Milk</span>
            <span className="badge mono">2026-08-25</span>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Talabat reconciliation</h3>
          <div className="deduction-row">
            <span>Payout difference</span>
            <span className="badge err mono">-200 IQD</span>
          </div>
          <div className="deduction-row">
            <span>Incorrect commission</span>
            <span className="badge err mono">+200 IQD</span>
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: ".9rem" }}>
        Open <strong>{t("nav.pos")}</strong> to see the live, tested calculation engine deduct
        different packaging per channel and compute cost &amp; margin in real time.
      </p>
    </div>
  );
}
