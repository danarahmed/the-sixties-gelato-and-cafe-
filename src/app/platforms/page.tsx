import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getSalesOrders } from "@/lib/db/read";
import { channelLabel, fmtIQD, PLATFORM_CHANNELS } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const orders = await getSalesOrders(500);
  const platform = orders.filter(
    (o) => PLATFORM_CHANNELS.includes(o.channel as SalesChannel) && o.status === "completed",
  );
  const net = platform.reduce((s, o) => s + o.net, 0);
  const margin = platform.reduce((s, o) => s + (o.net - o.cogs), 0);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.platforms")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        A delivery-platform order is platform-paid: the customer pays the platform, and the sale
        sits in <strong>1100 Platform receivable</strong> until the platform pays out. Direct
        delivery is not a platform sale — it is taken as cash or card.
      </p>
      <div className="card" style={{ borderColor: "var(--warn)" }}>
        <strong>Not built yet: settlement import.</strong>{" "}
        <span className="muted" style={{ fontSize: ".88rem" }}>
          Matching a platform&apos;s statement to these orders (commission, fees, the payout, and
          anything missing) is not available in the app yet, so 1100 is not cleared by the system.
          Until it is, record each payout by hand as a journal — Dr 1020 Bank, Dr 5100/5200 for
          commission and fees, Cr 1100 — and keep the statement with it.
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))" }}>
        <div className="card stat">
          <span className="label">Platform orders shown</span>
          <span className="value">{platform.length}</span>
        </div>
        <div className="card stat">
          <span className="label">Their net sales</span>
          <span className="value mono">{fmtIQD(net)}</span>
        </div>
        <div className="card stat">
          <span className="label">Before commission</span>
          <span className="value mono" style={{ color: "var(--ok)" }}>
            {fmtIQD(margin)}
          </span>
        </div>
      </div>

      {platform.length === 0 ? (
        <EmptyState
          title="No delivery-platform sales yet"
          hint="Talabat orders rung up on the till appear here."
        />
      ) : (
        <div className="card tw">
          <h3 style={{ marginTop: 0 }}>Platform orders</h3>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>When</th>
                <th>Platform</th>
                <th>Items</th>
                <th className="right">Net</th>
                <th className="right">COGS</th>
                <th className="right">Before commission</th>
              </tr>
            </thead>
            <tbody>
              {platform.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.id.slice(0, 8)}</td>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>
                    {dateTimeIn(profile.timezone, o.placedAt)}
                  </td>
                  <td className="muted">{channelLabel[o.channel as SalesChannel] ?? o.channel}</td>
                  <td>{o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}</td>
                  <td className="right mono">{fmtIQD(o.net)}</td>
                  <td className="right mono">{fmtIQD(o.cogs)}</td>
                  <td className="right mono">{fmtIQD(o.net - o.cogs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
