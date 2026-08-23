import { getT } from "@/lib/i18n/server";
import { Money, IQD } from "@domain/money/money.js";
import { ordersComputed, stockStatus, talabatPayout, settlementReport } from "@/lib/demo/data";

export default async function DashboardPage() {
  const t = await getT();
  const orders = ordersComputed();
  const net = Money.sum(
    orders.map((o) => o.net),
    IQD,
  ).quantize();
  const grossProfit = Money.sum(
    orders.map((o) => o.margin),
    IQD,
  ).quantize();
  const avg = orders.length ? net.divide(orders.length).quantize() : Money.zero(IQD);
  const { payout, contribution } = talabatPayout();
  const stock = stockStatus();
  const low = stock.filter((s) => s.low);
  const expiring = stock.filter((s) => s.expiringSoon);
  const issues = settlementReport().report.issues;

  const kpis = [
    { label: t("dash.netSales"), value: net.format() },
    { label: t("dash.grossProfit"), value: grossProfit.format(), tone: "ok" },
    { label: t("dash.contribution") + " (Talabat)", value: contribution.format(), tone: "ok" },
    { label: t("dash.orders"), value: String(orders.length) },
    { label: t("dash.avgOrder"), value: avg.format() },
    { label: t("dash.platformPayout"), value: payout.expectedPayout.format(), tone: "warn" },
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
            <span
              className="value mono"
              style={{ color: k.tone === "ok" ? "var(--ok)" : undefined }}
            >
              {k.value}
            </span>
          </div>
        ))}
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
      >
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("dash.lowStock")}</h3>
          {low.length === 0 && <span className="badge ok">All above reorder</span>}
          {low.map((s) => (
            <div key={s.itemId} className="deduction-row">
              <span>{s.name}</span>
              <span className="badge warn mono">
                {s.onHandBase} / {s.reorderBase}
              </span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("dash.expiring")}</h3>
          {expiring.length === 0 && <span className="badge ok">Nothing expiring ≤ 3 days</span>}
          {expiring.map((s) => (
            <div key={s.itemId} className="deduction-row">
              <span>{s.name}</span>
              <span className="badge err mono">{s.expiry}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Talabat reconciliation</h3>
          {issues.length === 0 && <span className="badge ok">No issues</span>}
          {issues.map((i, idx) => (
            <div key={idx} className="deduction-row">
              <span>{i.type.replace(/_/g, " ")}</span>
              <span className="badge err mono">{i.delta ? i.delta.format() : "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="muted" style={{ fontSize: ".9rem" }}>
        Open <strong>{t("nav.pos")}</strong> to add items to a cart and complete a sale — watch cost
        and margin change with the channel. Every other screen (Orders, Inventory, Production,
        Purchasing, Count, Platforms, Accounting, Reports) is now live on demo data.
      </p>
    </div>
  );
}
