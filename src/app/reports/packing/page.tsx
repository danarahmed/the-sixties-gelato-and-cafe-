import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/ui";
import { ReportVisit } from "@/components/reports/ReportVisit";
import { getLocale, getT } from "@/lib/i18n/server";
import { getChannels } from "@/lib/db/channels";
import { requirePermission } from "@/lib/auth/session";
import { getPackingReport } from "@/lib/db/packing";
import { addDays, businessToday } from "@/lib/dates";
import { channelName } from "@/lib/channels";
import { fmtIQD } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAYS = [7, 30, 90] as const;

/**
 * Packing (0107): what the orders went out in and what it cost, by day, by
 * way of selling, by cashier, and the orders that took the most. Free to the
 * customer; a cost to the café, on 5500 Packaging.
 */
export default async function PackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const [t, sp, channels, locale] = await Promise.all([
    getT(),
    searchParams,
    getChannels(),
    getLocale(),
  ]);
  const way = (code: string) => channelName(channels, code, locale, t);
  const days = DAYS.find((d) => String(d) === sp.days) ?? 7;
  const today = businessToday(profile.timezone);
  const r = await getPackingReport(addDays(today, -(days - 1)), today);
  if (!r) redirect("/reports");

  return (
    <div className="grid" style={{ gap: 16 }}>
      <ReportVisit path="/reports/packing" />
      <div className="phead">
        <h1>{t("Packing")}</h1>
        <Link href="/reports" className="sc">
          {t("Back to Reports")}
        </Link>
      </div>
      <PageIntro
        text={t(
          "What the orders went out in, and what it cost the café: by day, by way of selling and by cashier, and the orders that took the most. Free to the customer; on 5500 Packaging.",
        )}
        more={t("How this works")}
      />
      <div className="row" style={{ gap: 8 }}>
        {DAYS.map((d) => (
          <Link
            key={d}
            href={`/reports/packing?days=${d}`}
            className={d === days ? "chip active" : "chip"}
          >
            {t("Last {n} days", { n: d })}
          </Link>
        ))}
      </div>
      {r.orders === 0 ? (
        <EmptyState title={t("No order went out in packing in these days")} />
      ) : (
        <>
          <div className="card tw">
            <p style={{ marginTop: 0 }} data-testid="packing-total">
              <strong>{fmtIQD(r.total)}</strong>{" "}
              {t("on {n} orders · {per} an order", {
                n: r.orders,
                per: fmtIQD(Math.round(r.total / r.orders)),
              })}
            </p>
            <table data-testid="packing-by-item">
              <thead>
                <tr>
                  <th>{t("Item")}</th>
                  <th className="right">{t("Used")}</th>
                  <th className="right">{t("Cost")}</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((i) => (
                  <tr key={i.itemId}>
                    <td>{i.name}</td>
                    <td className="right mono">{i.qty}</td>
                    <td className="right mono">{fmtIQD(i.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}
          >
            <div className="card tw">
              <h3 style={{ marginTop: 0 }}>{t("By way of selling")}</h3>
              <table data-testid="packing-by-channel">
                <tbody>
                  {r.byChannel.map((c) => (
                    <tr key={c.channel}>
                      <td>{way(c.channel)}</td>
                      <td className="right mono">{c.orders}</td>
                      <td className="right mono">{fmtIQD(c.cost)}</td>
                      <td className="right mono muted">{fmtIQD(c.perOrder)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card tw">
              <h3 style={{ marginTop: 0 }}>{t("By cashier")}</h3>
              <table data-testid="packing-by-cashier">
                <tbody>
                  {r.byCashier.map((c) => (
                    <tr key={c.memberId ?? "none"}>
                      <td>{c.name}</td>
                      <td className="right mono">{c.orders}</td>
                      <td className="right mono">{fmtIQD(c.cost)}</td>
                      <td className="right mono muted">{fmtIQD(c.perOrder)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card tw">
              <h3 style={{ marginTop: 0 }}>{t("By day")}</h3>
              <table data-testid="packing-by-day">
                <tbody>
                  {r.byDay.map((d) => (
                    <tr key={d.day}>
                      <td dir="ltr">{d.day}</td>
                      <td className="right mono">{d.orders}</td>
                      <td className="right mono">{fmtIQD(d.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card tw">
            <h3 style={{ marginTop: 0 }}>{t("The orders that took the most")}</h3>
            <table data-testid="packing-orders">
              <thead>
                <tr>
                  <th>{t("Order")}</th>
                  <th>{t("Way of selling")}</th>
                  <th>{t("What it went out in")}</th>
                  <th className="right">{t("Sale")}</th>
                  <th className="right">{t("Packing")}</th>
                </tr>
              </thead>
              <tbody>
                {r.topOrders.map((o) => (
                  <tr key={o.orderId}>
                    <td className="mono">{o.turnNo ?? o.orderId.slice(0, 8)}</td>
                    <td>{way(o.channel)}</td>
                    <td>{o.what}</td>
                    <td className="right mono">{fmtIQD(o.sale)}</td>
                    <td className="right mono">{fmtIQD(o.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
