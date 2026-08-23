import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { fetchStockBoard } from "@/lib/db/inventory";
import { getSalesOrders } from "@/lib/db/read";
import { channelLabel, fmtIQD } from "@/lib/format";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getT();
  const [board, orders] = await Promise.all([
    fetchStockBoard().catch(() => []),
    getSalesOrders(500).catch(() => []),
  ]);
  const stock = board ?? [];

  const net = orders.reduce((s, o) => s + o.net, 0);
  const cogs = orders.reduce((s, o) => s + o.cogs, 0);
  const grossProfit = net - cogs;
  const avg = orders.length ? Math.round(net / orders.length) : 0;
  const low = stock.filter((s) => s.isLow);
  const invValue = stock.reduce((s, r) => s + r.value, 0);

  const kpis = [
    { label: t("dash.netSales"), value: fmtIQD(net) },
    { label: t("dash.grossProfit"), value: fmtIQD(grossProfit), tone: "ok" },
    { label: t("dash.orders"), value: String(orders.length) },
    { label: t("dash.avgOrder"), value: fmtIQD(avg) },
    { label: "Inventory value", value: fmtIQD(invValue) },
    { label: t("dash.lowStock"), value: String(low.length), tone: low.length ? "warn" : "ok" },
  ];

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("dash.title")}</h1>

      {orders.length === 0 && stock.length === 0 && (
        <div className="card" style={{ padding: "20px 16px" }}>
          <strong>Your business starts empty.</strong>
          <p className="muted" style={{ fontSize: ".92rem", margin: "8px 0 0" }}>
            Nothing here is demo data any more. Add stock on <Link href="/inventory">Inventory</Link>,
            build a menu on <Link href="/products">Products</Link>, receive purchases on{" "}
            <Link href="/purchasing">Purchasing</Link>, then sell on <Link href="/pos">POS</Link> — every
            figure on this dashboard is computed from what you enter.
          </p>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {kpis.map((k) => (
          <div key={k.label} className="card stat">
            <span className="label">{k.label}</span>
            <span
              className="value mono"
              style={{ color: k.tone === "ok" ? "var(--ok)" : k.tone === "warn" ? "var(--warn)" : undefined }}
            >
              {k.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("dash.lowStock")}</h3>
          {stock.length === 0 ? (
            <span className="muted">No items yet.</span>
          ) : low.length === 0 ? (
            <span className="badge ok">All above reorder</span>
          ) : (
            low.map((s) => (
              <div key={s.itemId} className="deduction-row">
                <span>{s.name}</span>
                <span className="badge warn mono">
                  {s.onHandBase.toLocaleString()} / {s.reorderBase?.toLocaleString() ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recent sales</h3>
          {orders.length === 0 ? (
            <span className="muted">No sales yet.</span>
          ) : (
            orders.slice(0, 6).map((o) => (
              <div key={o.id} className="deduction-row">
                <span>
                  <span className="badge">{channelLabel[o.channel as SalesChannel] ?? o.channel}</span>{" "}
                  {o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ") || "—"}
                </span>
                <span className="mono">{fmtIQD(o.net)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="muted" style={{ fontSize: ".9rem" }}>
        Open <strong>{t("nav.pos")}</strong> to record a sale and watch cost, margin, stock, orders and
        the journal update together — all from the live database.
      </p>
    </div>
  );
}
