import Link from "next/link";
import { getMsg, getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { has, requirePermission } from "@/lib/auth/session";
import { findSaleIds, getSalesOrders } from "@/lib/db/read";
import { readSaleQuery, SEARCH_MAX } from "@/lib/find";
import { fmtIQD, fmtQty, orderStatusLabel, tenderLabel } from "@/lib/format";
import { fmtRate, fmtUSD } from "@/lib/fx";
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
  const [t, msg, sp, channels] = await Promise.all([
    getT(),
    getMsg(),
    searchParams,
    getChannelNames(),
  ]);
  // Find a sale (the September audit's P2-20): by what the receipt, a refund,
  // the platform or the customer calls it, whatever its day.
  const find = typeof sp.q === "string" ? sp.q.trim().slice(0, SEARCH_MAX) : "";
  const query = find ? readSaleQuery(find) : null;
  // Opened from a report: the sales of those days (and that channel).
  const today = businessToday(profile.timezone);
  const filtered = !find && (typeof sp.from === "string" || typeof sp.channel === "string");
  const yesterday = addDays(today, -1);
  const quickDays: [string, string, string][] = [
    ["Today", today, today],
    ["Yesterday", yesterday, yesterday],
    ["Last 7 days", addDays(today, -6), today],
  ];
  // The latest 100 to begin with: a page of 300 sales is long on a phone.
  const latest = sp.more === "1" ? 300 : 100;
  const from = parseDay(sp.from, today);
  const to = parseDay(sp.to, from);
  // Every channel, a platform out of use too: its sales are still there to see.
  const channel =
    typeof sp.channel === "string" && channels.channels.some((c) => c.code === sp.channel)
      ? sp.channel
      : "";
  const foundIds = query ? await findSaleIds(query) : [];
  const orders = find
    ? foundIds.length
      ? await getSalesOrders(foundIds.length, { ids: foundIds })
      : []
    : await getSalesOrders(
        filtered ? 1000 : latest,
        filtered
          ? {
              fromTs: dayStart(from, profile.timezone),
              toTs: dayStart(addDays(to, 1), profile.timezone),
              channel: channel || undefined,
            }
          : {},
      );
  // A sale part-refunded (0037) counts for what is left of it.
  const live = orders.filter((o) => o.status === "completed" || o.status === "partially_refunded");
  const totalNet = live.reduce((s, o) => s + o.net - o.refunded, 0);
  const totalMargin = live.reduce(
    (s, o) => s + (o.net - o.refunded) - (o.cogs - o.costReturned),
    0,
  );
  const canVoid = has(profile, "sale.void");
  const canRefund = has(profile, "sale.refund");

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.orders")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        <Rich
          text={t(
            "A sale is never edited. A sale rung in error is <b>voided</b> until the drawer's session holding it closes — revenue, payment, cost and stock all come back exactly. After that, money goes back to the customer by a <b>refund</b> of some of its items or all of them, through Sales returns, the way it was paid; only goods that can go back on the shelf return to stock. Both take a reason from the list and are on the audit trail; one approved by a second person (their name and PIN) is marked so, and one without waits for the owner on the exceptions report.",
          )}
        />
      </p>

      <form
        className="card"
        role="search"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label style={{ flex: "1 1 260px" }}>
          <div className="sc">{t("Find a sale")}</div>
          <input
            type="search"
            name="q"
            defaultValue={find}
            maxLength={SEARCH_MAX}
            dir="auto"
            data-testid="find-sale"
            placeholder={t("Sale or journal number, platform order, customer")}
          />
        </label>
        <button type="submit">{t("Find")}</button>
        {find && (
          <Link className="badge" href="/orders">
            {t("The latest sales")}
          </Link>
        )}
      </form>

      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">{t("From")}</div>
          <input type="date" name="from" defaultValue={filtered ? from : ""} />
        </label>
        <label>
          <div className="sc">{t("To")}</div>
          <input type="date" name="to" defaultValue={filtered ? to : ""} />
        </label>
        <label>
          <div className="sc">{t("Channel")}</div>
          <select name="channel" defaultValue={channel}>
            <option value="">{t("Every channel")}</option>
            {channels.channels.map((c) => (
              <option key={c.code} value={c.code}>
                {channels.name(c.code)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{t("Show")}</button>
        {/* The days asked for most, a tap each, in the café's day. */}
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }} data-testid="orders-days">
          {quickDays.map(([label, f, tt]) => (
            <Link
              key={label}
              className={filtered && from === f && to === tt ? "badge ok" : "badge"}
              href={`/orders?from=${f}&to=${tt}${channel ? `&channel=${channel}` : ""}`}
              aria-current={filtered && from === f && to === tt ? "true" : undefined}
            >
              {t(label)}
            </Link>
          ))}
        </span>
        {filtered && (
          <Link className="badge" href="/orders">
            {t("The latest sales")}
          </Link>
        )}
      </form>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))" }}>
        <div className="card stat">
          <span className="label">
            {find
              ? t("Completed sales found for “{q}”", { q: find })
              : filtered
                ? from === to
                  ? channel
                    ? t("Completed sales on {day}, {channel}", {
                        day: from,
                        channel: channels.name(channel),
                      })
                    : t("Completed sales on {day}", { day: from })
                  : channel
                    ? t("Completed sales {from} to {to}, {channel}", {
                        from,
                        to,
                        channel: channels.name(channel),
                      })
                    : t("Completed sales {from} to {to}", { from, to })
                : t("Completed sales shown")}
          </span>
          <span className="value">{live.length}</span>
        </div>
        <div className="card stat">
          <span className="label">{t("Their net sales")}</span>
          <span className="value mono">{fmtIQD(totalNet)}</span>
        </div>
        <div className="card stat">
          <span className="label">{t("Their sales margin (price less recipe cost)")}</span>
          <span className="value mono" style={{ color: "var(--ok)" }}>
            {fmtIQD(totalMargin)}
          </span>
        </div>
      </div>

      {orders.length === 0 ? (
        find ? (
          <EmptyState
            title={t("No sale matches “{q}”", { q: find })}
            hint={t(
              "Type the sale number printed after “Sale” on the receipt, its journal number, a refund's number, the platform's order number, or the customer's name or phone.",
            )}
          />
        ) : (
          <EmptyState
            title={t("No sales yet")}
            hint={t("Sales rung up on the till appear here.")}
          />
        )
      ) : (
        <div className="card tw">
          <table>
            <thead>
              <tr>
                <th>{t("Sale")}</th>
                <th>{t("When")}</th>
                <th>{t("Channel")}</th>
                <th>{t("Items")}</th>
                <th>{t("orders.paidBy")}</th>
                <th>{t("Status")}</th>
                <th className="right">{t("Net")}</th>
                <th className="right">{t("Margin")}</th>
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
                    <td className="mono" data-testid="sale-no">
                      {o.id.slice(0, 8)}
                    </td>
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
                    <td className="muted" data-testid="order-payments">
                      {o.payments.length > 1 || o.payments.some((p) => p.currency === "USD")
                        ? o.payments
                            .map((p) =>
                              p.currency === "USD"
                                ? t("{usd} at {rate} = {amount}", {
                                    usd: fmtUSD(p.usd ?? 0),
                                    rate: fmtRate(p.rate ?? 0),
                                    amount: fmtIQD(p.received ?? p.amount),
                                  })
                                : `${t(tenderLabel(p.type))} ${fmtIQD(p.amount)}`,
                            )
                            .join(" + ")
                        : o.tenders.map((x) => t(tenderLabel(x))).join(", ")}
                    </td>
                    <td>
                      <span className={`badge ${o.status === "completed" ? "ok" : "warn"}`}>
                        {t(orderStatusLabel(o.status))}
                      </span>
                      {o.refunds.map((r) => (
                        <div key={r.no} className="muted" style={{ fontSize: ".75rem" }}>
                          {t("Refund {no}: {amount} for {items}", {
                            no: r.no,
                            amount: fmtIQD(r.amount),
                            items: r.lines.map((l) => `${l.name} ×${fmtQty(l.qty)}`).join(", "),
                          })}
                          {r.tenders.length > 1 &&
                            ` (${r.tenders.map((x) => `${t(tenderLabel(x.type))} ${fmtIQD(x.amount)}`).join(", ")})`}
                          {" · "}
                          {r.approvedBy
                            ? t("{reason} · {by}, approved by {approver}", {
                                reason: msg(r.reason ?? ""),
                                by: r.by ?? "—",
                                approver: r.approvedBy,
                              })
                            : t("{reason} · {by}, no second person", {
                                reason: msg(r.reason ?? ""),
                                by: r.by ?? "—",
                              })}
                        </div>
                      ))}
                      {adj && (
                        <div className="muted" style={{ fontSize: ".75rem" }}>
                          {adj.by
                            ? adj.approvedBy
                              ? t("{reason} · {by}, approved by {approver}", {
                                  reason: msg(adj.reason ?? ""),
                                  by: adj.by,
                                  approver: adj.approvedBy,
                                })
                              : t("{reason} · {by}, no second person", {
                                  reason: msg(adj.reason ?? ""),
                                  by: adj.by,
                                })
                            : msg(adj.reason ?? "")}
                        </div>
                      )}
                    </td>
                    <td className="right mono">
                      {fmtIQD(o.net)}
                      {o.refunded > 0 && (
                        <div className="muted" style={{ fontSize: ".75rem" }}>
                          −{fmtIQD(o.refunded)}
                        </div>
                      )}
                    </td>
                    <td
                      className="right mono"
                      style={{ color: margin < 0 ? "var(--err)" : "var(--ok)" }}
                    >
                      {fmtIQD(margin)} ({pct}%)
                    </td>
                    <td className="right">
                      {/* Kept for a sale refunded whole, with nothing to offer, so the
                          refund's answer stays until it is closed. */}
                      {o.status !== "voided" && (canVoid || canRefund) && (
                        <OrderActions
                          orderId={o.id}
                          canVoid={canVoid && o.status === "completed"}
                          canRefund={
                            canRefund &&
                            (o.status === "completed" || o.status === "partially_refunded")
                          }
                          refund={{
                            orderId: o.id,
                            lines: o.lines,
                            tender: o.tenders[0] ?? "cash",
                            left: o.refundLeft,
                            channelLabel: channels.name(o.channel),
                            approvalOver: profile.refundApprovalOver,
                          }}
                          businessName={profile.businessName}
                          timezone={profile.timezone}
                          me={profile.name}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!find && !filtered && orders.length === latest && latest < 300 && (
            <p style={{ marginBottom: 0 }}>
              <Link href="/orders?more=1" data-testid="orders-more">
                {t("Show the latest 300")}
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
