import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import {
  getDailySales,
  getDrawerCounts,
  getDrawerStatus,
  getUnclosedDays,
  salesTotals,
} from "@/lib/db/books";
import { channelLabel, fmtIQD } from "@/lib/format";
import { addDays, businessToday, dateTimeIn } from "@/lib/dates";
import { DrawerCount, MoveCash } from "@/components/books/DrawerCount";
import { EmptyState } from "@/components/ui";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const from = addDays(today, -29);
  const canCount = has(profile, "day.close");
  const canMove = canCount || has(profile, "accounting.post");
  const [rows, counts, uncounted, drawer] = await Promise.all([
    getDailySales(from, today),
    getDrawerCounts(),
    getUnclosedDays(),
    canCount || canMove ? getDrawerStatus() : Promise.resolve(null),
  ]);
  // A day is counted once a drawer count follows its last sale: the café
  // trades past midnight, so one night's count may cover two calendar days.
  const notCounted = new Set(uncounted);
  const overdue = uncounted.filter((d) => d < today).length;
  const at = (ts: string | null) => (ts ? dateTimeIn(profile.timezone, ts) : null);

  const totals = salesTotals(rows);
  const days = new Set(rows.filter((r) => r.orders > 0).map((r) => r.day)).size;

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
          <div className="sc">Net sales, after refunds</div>
          <div className="v">{fmtIQD(totals.net)}</div>
          <div className="m">
            <Link className="drill" href={`/orders?from=${from}&to=${today}`}>
              Across {days} trading day(s)
            </Link>
          </div>
        </div>
        <div>
          <div className="sc">Refunds made</div>
          <div className="v red">({fmtIQD(totals.refunds)})</div>
          <div className="m">On the day they were made, through 4200 Sales returns</div>
        </div>
        <div>
          <div className="sc">Cost of what was sold</div>
          <div className="v">{fmtIQD(totals.cost)}</div>
          <div className="m">
            Sales margin {totals.net > 0 ? ((totals.margin / totals.net) * 100).toFixed(1) : "0.0"}%
            · before waste and fees
          </div>
        </div>
        <div>
          <div className="sc">Days whose cash is not counted</div>
          <div className="v" style={{ color: overdue > 0 ? "var(--warn)" : undefined }}>
            {uncounted.length}
          </div>
          <div className="m">
            {counts[0]
              ? `Drawer last counted ${at(counts[0].at)}`
              : "The drawer has not been counted yet"}
            {overdue > 0 ? ` · ${overdue} before today` : ""}
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <h3>Daily Sales Summaries</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            One line per day per channel · voided sales excluded · a refund on the day it was made
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
                  <th className="right">Sales</th>
                  <th className="right">Refunds</th>
                  <th className="right">Net sales</th>
                  <th className="right">Cost</th>
                  <th className="right">Cash</th>
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
                    <td className="right money">
                      <Link
                        className="drill"
                        href={`/orders?from=${r.day}&to=${r.day}&channel=${encodeURIComponent(r.channel)}`}
                      >
                        {r.orders}
                      </Link>
                    </td>
                    <td className="right money">{fmtIQD(r.net)}</td>
                    <td className="right money">{r.refunds ? `(${fmtIQD(r.refunds)})` : "—"}</td>
                    <td className="right money">{fmtIQD(r.net - r.refunds)}</td>
                    <td className="right money">{fmtIQD(r.cogs - r.returnedCost)}</td>
                    <td className="right">
                      <span className={`ref ${notCounted.has(r.day) ? "due" : "auto"}`}>
                        {notCounted.has(r.day) ? "Not counted" : "Counted"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canCount && drawer && (
        <section className="panel">
          <div className="panel-h">
            <h3>Count the Drawer</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Everything since the last count, whatever the day
            </span>
          </div>
          <DrawerCount status={drawer} since={at(drawer.since)} />
        </section>
      )}

      {canMove && drawer && (
        <section className="panel">
          <div className="panel-h">
            <h3>Move Cash</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Between the till, the safe, the bank and the owner
            </span>
          </div>
          <MoveCash isOwner={profile.roles.includes("owner")} safe={drawer.safe} />
        </section>
      )}

      {counts.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <h3>Drawer Counts</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Each covers the cash since the one before · over / short history
            </span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Counted</th>
                  <th className="right">Started with</th>
                  <th className="right">Should hold</th>
                  <th className="right">Counted</th>
                  <th className="right">Over / short</th>
                  <th className="right">Stayed</th>
                  <th className="right">Taken out</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr key={c.id}>
                    <td className="mono" style={{ fontSize: ".8rem" }}>
                      {c.byDay ? `${c.day} (by day)` : at(c.at)}
                      {!c.byDay && c.from && <div className="muted">since {at(c.from)}</div>}
                    </td>
                    <td className="right money">{fmtIQD(c.start)}</td>
                    <td className="right money">{fmtIQD(c.expected)}</td>
                    <td className="right money">{fmtIQD(c.counted)}</td>
                    <td
                      className="right money"
                      style={{ color: c.variance === 0 ? "var(--ok)" : "var(--err)" }}
                    >
                      {c.variance > 0 ? "+" : ""}
                      {fmtIQD(c.variance)}
                    </td>
                    <td className="right money">{c.left === null ? "—" : fmtIQD(c.left)}</td>
                    <td className="right money">
                      {c.taken ? `${fmtIQD(c.taken)} → ${c.takenTo}` : "—"}
                    </td>
                    <td className="muted">{c.by ?? "—"}</td>
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
