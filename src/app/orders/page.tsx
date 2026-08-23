import { getT } from "@/lib/i18n/server";
import { getSalesOrders } from "@/lib/db/read";
import { channelLabel, fmtIQD } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const t = await getT();
  const orders = await getSalesOrders(300).catch(() => []);
  const totalNet = orders.reduce((s, o) => s + o.net, 0);
  const totalMargin = orders.reduce((s, o) => s + (o.net - o.cogs), 0);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("nav.orders")}</h1>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))" }}>
        <div className="card stat">
          <span className="label">Orders</span>
          <span className="value">{orders.length}</span>
        </div>
        <div className="card stat">
          <span className="label">Net sales</span>
          <span className="value mono">{fmtIQD(totalNet)}</span>
        </div>
        <div className="card stat">
          <span className="label">Gross profit</span>
          <span className="value mono" style={{ color: "var(--ok)" }}>{fmtIQD(totalMargin)}</span>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No orders yet" hint="Record a sale on the POS screen — it appears here instantly." />
      ) : (
        <>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Time</th>
                  <th>Channel</th>
                  <th>Items</th>
                  <th className="right">Net</th>
                  <th className="right">COGS</th>
                  <th className="right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const margin = o.net - o.cogs;
                  const pct = o.net > 0 ? ((margin / o.net) * 100).toFixed(0) : "0";
                  return (
                    <tr key={o.id}>
                      <td className="mono">{o.id.slice(0, 8)}</td>
                      <td className="mono muted" style={{ fontSize: ".8rem" }}>
                        {o.placedAt.slice(11, 16)}
                      </td>
                      <td>
                        <span className="badge">{channelLabel[o.channel as SalesChannel] ?? o.channel}</span>
                      </td>
                      <td>{o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}</td>
                      <td className="right mono">{fmtIQD(o.net)}</td>
                      <td className="right mono">{fmtIQD(o.cogs)}</td>
                      <td className="right mono" style={{ color: margin < 0 ? "var(--err)" : "var(--ok)" }}>
                        {fmtIQD(margin)} ({pct}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: ".9rem", marginTop: 0 }}>
            Every sale is append-only. Corrections use voids/refunds, never edits.
          </p>
        </>
      )}
    </div>
  );
}
