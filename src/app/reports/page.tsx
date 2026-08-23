import { getT } from "@/lib/i18n/server";
import { productMargin, ordersComputed, channelLabel, CHANNELS } from "@/lib/demo/data";
import { Money, IQD } from "@domain/money/money.js";
import type { SalesChannel } from "@domain/sales/recipe.js";

export default async function ReportsPage() {
  const t = await getT();
  const margins = productMargin();
  const orders = ordersComputed();

  // Channel mix from today's orders.
  const byChannel = new Map<SalesChannel, { count: number; net: Money; margin: Money }>();
  for (const o of orders) {
    const cur = byChannel.get(o.order.channel) ?? {
      count: 0,
      net: Money.zero(IQD),
      margin: Money.zero(IQD),
    };
    byChannel.set(o.order.channel, {
      count: cur.count + 1,
      net: cur.net.add(o.net),
      margin: cur.margin.add(o.margin),
    });
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.reports")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Every figure below is computed live by the tested costing engine from the demo catalog.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Product margin by channel</h3>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
          Note how margin drops on Talabat — higher price, but extra packaging + the platform price
          gap. This is menu-engineering data.
        </p>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Channel</th>
              <th className="right">Price</th>
              <th className="right">Cost</th>
              <th className="right">Margin</th>
              <th className="right">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {margins.map((m, i) => (
              <tr key={i}>
                <td>{m.name}</td>
                <td>
                  <span className="badge">{channelLabel[m.channel]}</span>
                </td>
                <td className="right mono">{m.price.format()}</td>
                <td className="right mono">{m.cost.format()}</td>
                <td
                  className="right mono"
                  style={{ color: m.margin.isNegative() ? "var(--err)" : "var(--ok)" }}
                >
                  {m.margin.format()}
                </td>
                <td className="right mono">{m.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Today&apos;s channel mix</h3>
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th className="right">Orders</th>
              <th className="right">Net sales</th>
              <th className="right">Gross profit</th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS.filter((c) => byChannel.has(c)).map((c) => {
              const v = byChannel.get(c)!;
              return (
                <tr key={c}>
                  <td>
                    <span className="badge">{channelLabel[c]}</span>
                  </td>
                  <td className="right mono">{v.count}</td>
                  <td className="right mono">{v.net.quantize().format()}</td>
                  <td className="right mono" style={{ color: "var(--ok)" }}>
                    {v.margin.quantize().format()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Available report set (scheduled)</h3>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          The data for these is already captured; the views + CSV/Excel/PDF export are being built:
          menu engineering, discount &amp; promotion profitability, actual-vs-theoretical ingredient
          usage &amp; food cost, waste by reason, stock variance &amp; ageing, supplier performance,
          production yield, platform reconciliation, cashier/shift reconciliation.
        </p>
      </div>
    </div>
  );
}
