import { getT } from "@/lib/i18n/server";
import { ordersComputed, orderDeductions, channelLabel } from "@/lib/demo/data";
import { Money, IQD } from "@domain/money/money.js";

export default async function OrdersPage() {
  const t = await getT();
  const orders = ordersComputed();
  const totalNet = Money.sum(
    orders.map((o) => o.net),
    IQD,
  ).quantize();
  const totalMargin = Money.sum(
    orders.map((o) => o.margin),
    IQD,
  ).quantize();

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.orders")}</h1>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))" }}>
        <div className="card stat">
          <span className="label">Orders today</span>
          <span className="value">{orders.length}</span>
        </div>
        <div className="card stat">
          <span className="label">Net sales</span>
          <span className="value mono">{totalNet.format()}</span>
        </div>
        <div className="card stat">
          <span className="label">Gross profit</span>
          <span className="value mono" style={{ color: "var(--ok)" }}>
            {totalMargin.format()}
          </span>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Time</th>
              <th>Channel</th>
              <th>Product</th>
              <th className="right">Net</th>
              <th className="right">COGS</th>
              <th className="right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order.id}>
                <td className="mono">{o.order.id}</td>
                <td className="mono">{o.order.time}</td>
                <td>
                  <span className="badge">{channelLabel[o.order.channel]}</span>
                </td>
                <td>
                  {o.productName} ×{o.order.qty}
                </td>
                <td className="right mono">{o.net.format()}</td>
                <td className="right mono">{o.cogs.format()}</td>
                <td className="right mono" style={{ color: "var(--ok)" }}>
                  {o.margin.format()} ({o.marginPct}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: "8px 0 0" }}>Drill into an order</h3>
      <p className="muted" style={{ fontSize: ".9rem", marginTop: 0 }}>
        Every sale is append-only. Corrections use voids/refunds, never edits. Expand an order to
        see the exact inventory movements it posted.
      </p>
      {orders.map((o) => (
        <details key={o.order.id} className="card">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            {o.order.id} — {o.productName} ×{o.order.qty} · {channelLabel[o.order.channel]} ·{" "}
            {o.net.format()}
          </summary>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Item deducted</th>
                <th className="right">Qty (base)</th>
                <th className="right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {orderDeductions(o.order).map((d) => (
                <tr key={d.itemId}>
                  <td>{d.name}</td>
                  <td className="right mono">−{d.qty}</td>
                  <td className="right mono">{d.cost.format()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
