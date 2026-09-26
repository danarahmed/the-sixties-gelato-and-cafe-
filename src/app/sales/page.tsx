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
import { fmtIQD } from "@/lib/format";
import { getChannelNames } from "@/lib/db/channels";
import { addDays, businessToday, dateTimeIn } from "@/lib/dates";
import { DrawerCount, MoveCash } from "@/components/books/DrawerCount";
import { CardTakingsPanel } from "@/components/books/CardTakings";
import { getCardTakings } from "@/lib/db/settlements";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const from = addDays(today, -29);
  const canCount = has(profile, "day.close");
  const canMove = canCount || has(profile, "accounting.post");
  const [rows, counts, uncounted, drawer, card, channels] = await Promise.all([
    getDailySales(from, today),
    getDrawerCounts(),
    getUnclosedDays(),
    canCount || canMove ? getDrawerStatus() : Promise.resolve(null),
    getCardTakings(),
    getChannelNames(),
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
        <span className="sc">
          {t("Last 30 trading days · {timezone}", { timezone: t(profile.timezone) })}
        </span>
        <div className="sp">
          {has(profile, "sale.create") && (
            <Link href="/pos">
              <button className="btn-primary">{t("Open POS")}</button>
            </Link>
          )}
        </div>
      </div>

      <div className="cards2">
        <div>
          <div className="sc">{t("Net sales, after refunds")}</div>
          <div className="v">{fmtIQD(totals.net)}</div>
          <div className="m">
            <Link className="drill" href={`/orders?from=${from}&to=${today}`}>
              {t("Across {days} trading day(s)", { days })}
            </Link>
          </div>
        </div>
        <div>
          <div className="sc">{t("Refunds made")}</div>
          <div className="v red">({fmtIQD(totals.refunds)})</div>
          <div className="m">{t("On the day they were made, through 4200 Sales returns")}</div>
        </div>
        <div>
          <div className="sc">{t("Cost of what was sold")}</div>
          <div className="v">{fmtIQD(totals.cost)}</div>
          <div className="m">
            {t("Sales margin {margin}% · before waste and fees", {
              margin: totals.net > 0 ? ((totals.margin / totals.net) * 100).toFixed(1) : "0.0",
            })}
          </div>
        </div>
        <div>
          <div className="sc">{t("Days whose cash is not counted")}</div>
          <div className="v" style={{ color: overdue > 0 ? "var(--warn)" : undefined }}>
            {uncounted.length}
          </div>
          <div className="m">
            {counts[0]
              ? t("Drawer last counted {when}", { when: String(at(counts[0].at)) })
              : t("The drawer has not been counted yet")}
            {overdue > 0 ? ` · ${t("{n} before today", { n: overdue })}` : ""}
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <h3>{t("Daily Sales Summaries")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t(
              "One line per day per channel · voided sales excluded · a refund on the day it was made",
            )}
          </span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={t("No sales in the last 30 days")}
            hint={t("Sales rung up on the till appear here by day.")}
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Date")}</th>
                  <th>{t("Channel")}</th>
                  <th className="right">{t("Orders")}</th>
                  <th className="right">{t("Sales")}</th>
                  <th className="right">{t("Refunds")}</th>
                  <th className="right">{t("Net sales")}</th>
                  <th className="right">{t("Cost")}</th>
                  <th className="right">{t("Cash")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day + r.channel}>
                    <td>{r.day}</td>
                    <td>
                      <span className="ref auto">{channels.name(r.channel)}</span>
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
                        {notCounted.has(r.day) ? t("Not counted") : t("Counted")}
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
            <h3>{t("Count the Drawer")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("Everything since the last count, whatever the day")}
            </span>
          </div>
          <DrawerCount status={drawer} since={at(drawer.since)} />
        </section>
      )}

      {canMove && drawer && (
        <section className="panel">
          <div className="panel-h">
            <h3>{t("Move Cash")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("Between the till, the safe, the bank and the owner")}
            </span>
          </div>
          <MoveCash isOwner={profile.roles.includes("owner")} safe={drawer.safe} />
        </section>
      )}

      <section className="panel" id="card">
        <div className="panel-h">
          <h3>{t("Card Takings")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Settled against the terminal's report and what reached the bank · the fee to 6500")}
          </span>
        </div>
        <CardTakingsPanel
          takings={card}
          canSettle={has(profile, "accounting.post")}
          today={today}
        />
      </section>

      {counts.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <h3>{t("Drawer Counts")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("Each covers the cash since the one before · over / short history")}
            </span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Counted")}</th>
                  <th className="right">{t("Started with")}</th>
                  <th className="right">{t("Should hold")}</th>
                  <th className="right">{t("Counted")}</th>
                  <th className="right">{t("Over / short")}</th>
                  <th className="right">{t("Stayed")}</th>
                  <th className="right">{t("Taken out")}</th>
                  <th>{t("By")}</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr key={c.id}>
                    <td className="mono" style={{ fontSize: ".8rem" }}>
                      {c.byDay ? t("{day} (by day)", { day: String(c.day) }) : at(c.at)}
                      {!c.byDay && c.from && (
                        <div className="muted">
                          {t("since {when}", { when: String(at(c.from)) })}
                        </div>
                      )}
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
                      {c.taken ? `${fmtIQD(c.taken)} → ${t(String(c.takenTo))}` : "—"}
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
