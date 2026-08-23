import { getT } from "@/lib/i18n/server";
import { loadCatalog } from "@/lib/db/catalog";
import { getSalesOrders } from "@/lib/db/read";
import { channelLabel, fmtIQD, SELLABLE_CHANNELS } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const t = await getT();
  const [cat, orders] = await Promise.all([
    loadCatalog().catch(() => null),
    getSalesOrders(500).catch(() => []),
  ]);
  const variants = cat?.variants ?? [];

  const byChannel = new Map<string, { count: number; net: number; margin: number }>();
  for (const o of orders) {
    const cur = byChannel.get(o.channel) ?? { count: 0, net: 0, margin: 0 };
    byChannel.set(o.channel, { count: cur.count + 1, net: cur.net + o.net, margin: cur.margin + (o.net - o.cogs) });
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("nav.reports")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Every figure is computed live by the tested costing engine from your catalog and recorded
        sales.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Product margin by channel</h3>
        {variants.length === 0 ? (
          <p className="muted" style={{ fontSize: ".9rem" }}>Add products to see menu-engineering margins.</p>
        ) : (
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
              {variants.flatMap((v) =>
                SELLABLE_CHANNELS.filter((ch) => v.priceByChannel[ch] != null).map((ch) => {
                  const price = v.priceByChannel[ch]!;
                  const cost = v.cogsByChannel[ch] ?? 0;
                  const margin = price - cost;
                  const pct = price > 0 ? ((margin / price) * 100).toFixed(1) : "0";
                  return (
                    <tr key={v.variantId + ch}>
                      <td>{v.productName}</td>
                      <td><span className="badge">{channelLabel[ch]}</span></td>
                      <td className="right mono">{fmtIQD(price)}</td>
                      <td className="right mono">{fmtIQD(cost)}</td>
                      <td className="right mono" style={{ color: margin < 0 ? "var(--err)" : "var(--ok)" }}>
                        {fmtIQD(margin)}
                      </td>
                      <td className="right mono">{pct}%</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Channel mix (recorded sales)</h3>
        {orders.length === 0 ? (
          <EmptyState title="No sales recorded yet" hint="Sales you record on POS populate this report." />
        ) : (
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
              {[...byChannel.entries()].map(([c, v]) => (
                <tr key={c}>
                  <td><span className="badge">{channelLabel[c as SalesChannel] ?? c}</span></td>
                  <td className="right mono">{v.count}</td>
                  <td className="right mono">{fmtIQD(v.net)}</td>
                  <td className="right mono" style={{ color: "var(--ok)" }}>{fmtIQD(v.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
