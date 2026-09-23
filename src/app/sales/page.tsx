import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getDailySales, getDayCloses, getDayTotals, type DayTotals } from "@/lib/db/books";
import { channelLabel, fmtIQD } from "@/lib/format";
import { addDays, businessToday } from "@/lib/dates";
import { DayClose } from "@/components/books/DayClose";
import { EmptyState } from "@/components/ui";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const from = addDays(today, -29);
  const [rows, closes] = await Promise.all([getDailySales(from, today), getDayCloses()]);

  const closedDays = new Set(closes.map((c) => c.day));
  // Days that traded and are not closed yet, plus today — oldest first, so
  // the drawer is counted in order.
  const openDays = [...new Set([...rows.map((r) => r.day), today])]
    .filter((d) => !closedDays.has(d) && d <= today)
    .sort()
    .slice(-10);
  const canClose = has(profile, "day.close");
  const totals: DayTotals[] = canClose
    ? await Promise.all(openDays.map((d) => getDayTotals(d)))
    : [];

  const net = rows.reduce((s, r) => s + r.net, 0);
  const cogs = rows.reduce((s, r) => s + r.cogs, 0);
  const refunded = rows.reduce((s, r) => s + r.refunded, 0);
  const days = new Set(rows.map((r) => r.day)).size;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.sales")}</h1>
        <span className="sc">Last 30 trading days · {profile.timezone}</span>
        <div className="sp">
          {has(profile, "sale.create") && (
            <Link href="/pos">
              <button className="btn-primary">Open POS</button>
            </Link>
          )}
        </div>
      </div>

      <div className="cards2">
        <div>
          <div className="sc">Net sales</div>
          <div className="v">{fmtIQD(net)}</div>
          <div className="m">Across {days} trading day(s)</div>
        </div>
        <div>
          <div className="sc">Refunded since</div>
          <div className="v red">({fmtIQD(refunded)})</div>
          <div className="m">Through 4200 Sales returns</div>
        </div>
        <div>
          <div className="sc">Cost of sales</div>
          <div className="v">{fmtIQD(cogs)}</div>
          <div className="m">
            Margin {net > 0 ? (((net - cogs) / net) * 100).toFixed(1) : "0.0"}%
          </div>
        </div>
        <div>
          <div className="sc">Days not yet closed</div>
          <div className="v" style={{ color: openDays.length > 1 ? "var(--warn)" : undefined }}>
            {openDays.length}
          </div>
          <div className="m">A period cannot lock with an open day</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <h3>Daily Sales Summaries</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            One line per day per channel · voided sales excluded
          </span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="No sales in the last 30 days"
            hint="Sales rung up on the till appear here by day."
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Channel</th>
                  <th className="right">Orders</th>
                  <th className="right">Net</th>
                  <th className="right">Later refunded</th>
                  <th className="right">COGS</th>
                  <th className="right">Day</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day + r.channel}>
                    <td>{r.day}</td>
                    <td>
                      <span className="ref auto">
                        {channelLabel[r.channel as SalesChannel] ?? r.channel}
                      </span>
                    </td>
                    <td className="right money">{r.orders}</td>
                    <td className="right money">{fmtIQD(r.net)}</td>
                    <td className="right money">{r.refunded ? `(${fmtIQD(r.refunded)})` : "—"}</td>
                    <td className="right money">{fmtIQD(r.cogs)}</td>
                    <td className="right">
                      <span className={`ref ${closedDays.has(r.day) ? "auto" : "due"}`}>
                        {closedDays.has(r.day) ? "Closed" : "Open"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canClose && (
        <section className="panel">
          <div className="panel-h">
            <h3>Close the Day</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Count the drawer against what the till says it took in cash
            </span>
          </div>
          <DayClose totals={totals} />
        </section>
      )}

      {closes.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <h3>Closed Days</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Cash over / short history
            </span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="right">Float</th>
                  <th className="right">Till expected</th>
                  <th className="right">Counted</th>
                  <th className="right">Over / short</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {closes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.day}</td>
                    <td className="right money">{fmtIQD(c.openingFloat)}</td>
                    <td className="right money">{fmtIQD(c.expectedCash)}</td>
                    <td className="right money">{fmtIQD(c.countedCash)}</td>
                    <td
                      className="right money"
                      style={{ color: c.variance === 0 ? "var(--ok)" : "var(--err)" }}
                    >
                      {c.variance > 0 ? "+" : ""}
                      {fmtIQD(c.variance)}
                    </td>
                    <td className="muted">{c.closedBy ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
