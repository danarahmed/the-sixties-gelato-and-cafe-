import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getSalesOrders } from "@/lib/db/read";
import { fmtIQD, orderStatusLabel, tenderLabel } from "@/lib/format";
import { getChannelNames } from "@/lib/db/channels";
import { addDays, businessToday, dateTimeIn, dayStart, parseDay } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { OrderActions } from "@/components/OrderActions";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const [t, sp, channels] = await Promise.all([getT(), searchParams, getChannelNames()]);
  // Opened from a report: the sales of those days (and that channel).
  const today = businessToday(profile.timezone);
  const filtered = typeof sp.from === "string" || typeof sp.channel === "string";
  const from = parseDay(sp.from, today);
  const to = parseDay(sp.to, from);
  // Every channel, a platform out of use too: its sales are still there to see.
  const channel =
    typeof sp.channel === "string" && channels.channels.some((c) => c.code === sp.channel)
      ? sp.channel
      : "";
  const orders = await getSalesOrders(
    filtered ? 1000 : 300,
    filtered
      ? {
          fromTs: dayStart(from, profile.timezone),
          toTs: dayStart(addDays(to, 1), profile.timezone),
          channel: channel || undefined,
        }
      : {},
  );
  const live = orders.filter((o) => o.status === "completed");
  const totalNet = live.reduce((s, o) => s + o.net, 0);
  const totalMargin = live.reduce((s, o) => s + (o.net - o.cogs), 0);
  const canVoid = has(profile, "sale.void");
  const canRefund = has(profile, "sale.refund");

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.orders")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        A sale is never edited. A sale rung in error is <strong>voided</strong> until the drawer
        holding it is counted — revenue, payment, cost and stock all come back exactly. After that,
        money goes back to the customer by a <strong>refund</strong>, through Sales returns (4200);
        only goods that can go back on the shelf return to stock. Both take a reason from the list
        and are on the audit trail; one approved by a second person (their name and PIN) is marked
        so, and one without waits for the owner on the exceptions report.
      </p>

      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">From</div>
          <input type="date" name="from" defaultValue={filtered ? from : ""} />
        </label>
        <label>
          <div className="sc">To</div>
          <input type="date" name="to" defaultValue={filtered ? to : ""} />
        </label>
        <label>
          <div className="sc">Channel</div>
          <select name="channel" defaultValue={channel}>
            <option value="">Every channel</option>
            {channels.channels.map((c) => (
              <option key={c.code} value={c.code}>
                {channels.name(c.code)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Show</button>
        {filtered && (
          <Link className="badge" href="/orders">
            The latest 300
          </Link>
        )}
      </form>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))" }}>
        <div className="card stat">
          <span className="label">
            {filtered
              ? `Completed sales ${from === to ? `on ${from}` : `${from} to ${to}`}${channel ? `, ${channels.name(channel)}` : ""}`
              : "Completed sales shown"}
          </span>
          <span className="value">{live.length}</span>
        </div>
        <div className="card stat">
          <span className="label">Their net sales</span>
          <span className="value mono">{fmtIQD(totalNet)}</span>
        </div>
        <div className="card stat">
          <span className="label">Their sales margin (price less recipe cost)</span>
          <span className="value mono" style={{ color: "var(--ok)" }}>
            {fmtIQD(totalMargin)}
          </span>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No sales yet" hint="Sales rung up on the till appear here." />
      ) : (
        <div className="card tw">
          <table>
            <thead>
              <tr>
                <th>Sale</th>
                <th>When</th>
                <th>Channel</th>
                <th>Items</th>
                <th>Paid</th>
                <th>Status</th>
                <th className="right">Net</th>
                <th className="right">Margin</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const margin = o.net - o.cogs;
                const pct = o.net > 0 ? ((margin / o.net) * 100).toFixed(0) : "0";
                const adj = o.adjustments[0];
                return (
                  <tr key={o.id}>
                    <td className="mono">{o.id.slice(0, 8)}</td>
                    <td className="mono muted" style={{ fontSize: ".8rem", whiteSpace: "nowrap" }}>
                      {dateTimeIn(profile.timezone, o.placedAt)}
                    </td>
                    <td>
                      <span className="badge">{channels.name(o.channel)}</span>
                    </td>
                    <td>
                      {o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}
                      {o.cashier && (
                        <div className="muted" style={{ fontSize: ".75rem" }}>
                          {o.cashier}
                        </div>
                      )}
                    </td>
                    <td className="muted">{o.tenders.map(tenderLabel).join(", ")}</td>
                    <td>
                      <span className={`badge ${o.status === "completed" ? "ok" : "warn"}`}>
                        {orderStatusLabel(o.status)}
                      </span>
                      {adj && (
                        <div className="muted" style={{ fontSize: ".75rem" }}>
                          {adj.reason}
                          {adj.by && (
                            <>
                              {" "}
                              · {adj.by}
                              {adj.approvedBy
                                ? `, approved by ${adj.approvedBy}`
                                : ", no second person"}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="right mono">{fmtIQD(o.net)}</td>
                    <td
                      className="right mono"
                      style={{ color: margin < 0 ? "var(--err)" : "var(--ok)" }}
                    >
                      {fmtIQD(margin)} ({pct}%)
                    </td>
                    <td className="right">
                      {o.status === "completed" && (canVoid || canRefund) && (
                        <OrderActions orderId={o.id} canVoid={canVoid} canRefund={canRefund} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
