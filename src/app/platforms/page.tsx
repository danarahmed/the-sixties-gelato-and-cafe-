import { getT } from "@/lib/i18n/server";
import { getSalesOrders } from "@/lib/db/read";
import { fmtIQD } from "@/lib/format";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const t = await getT();
  const orders = await getSalesOrders(500).catch(() => []);
  const platform = orders.filter((o) => o.channel === "talabat" || o.channel === "direct_delivery");
  const net = platform.reduce((s, o) => s + o.net, 0);
  const margin = platform.reduce((s, o) => s + (o.net - o.cogs), 0);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("nav.platforms")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        The customer&apos;s payment is <strong>not</strong> your revenue or your payout. Delivery
        sales you record on POS show below. Full settlement reconciliation (commission, fees,
        payout-vs-expected) activates when a Talabat statement is imported — the reconciliation engine
        and schema are in place; the CSV import is the next increment.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))" }}>
        <div className="card stat">
          <span className="label">Delivery orders</span>
          <span className="value">{platform.length}</span>
        </div>
        <div className="card stat">
          <span className="label">Delivery net sales</span>
          <span className="value mono">{fmtIQD(net)}</span>
        </div>
        <div className="card stat">
          <span className="label">Delivery gross profit</span>
          <span className="value mono" style={{ color: "var(--ok)" }}>{fmtIQD(margin)}</span>
        </div>
      </div>

      {platform.length === 0 ? (
        <EmptyState
          title="No delivery-platform sales yet"
          hint="Record a Talabat or direct-delivery sale on POS to populate this screen."
        />
      ) : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Delivery orders</h3>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Channel</th>
                <th>Items</th>
                <th className="right">Net</th>
                <th className="right">COGS</th>
                <th className="right">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {platform.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.id.slice(0, 8)}</td>
                  <td className="muted">{o.channel}</td>
                  <td>{o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}</td>
                  <td className="right mono">{fmtIQD(o.net)}</td>
                  <td className="right mono">{fmtIQD(o.cogs)}</td>
                  <td className="right mono" style={{ color: "var(--ok)" }}>{fmtIQD(o.net - o.cogs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
