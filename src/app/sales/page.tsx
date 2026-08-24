import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getDailySales, getDayTotals, getDayCloses } from "@/lib/db/books";
import { channelLabel, fmtIQD } from "@/lib/format";
import { DayClose } from "@/components/books/DayClose";
import { EmptyState } from "@/components/ui";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const t = await getT();
  const [rows, closes] = await Promise.all([
    getDailySales(30).catch(() => []),
    getDayCloses().catch(() => []),
  ]);

  const days = [...new Set(rows.map((r) => r.day))];
  const totalsByDay = await Promise.all(days.slice(0, 10).map((d) => getDayTotals(d)));
  const expectedByDay: Record<string, number> = {};
  for (const dt of totalsByDay) expectedByDay[dt.day] = dt.cash;
  const closedDays = new Set(closes.map((c) => c.day));

  const gross = rows.reduce((s, r) => s + r.gross, 0);
  const discount = rows.reduce((s, r) => s + r.discount, 0);
  const net = rows.reduce((s, r) => s + r.net, 0);
  const cogs = rows.reduce((s, r) => s + r.cogs, 0);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.sales")}</h1>
        <span className="sc">Daily summaries from the till</span>
        <div className="sp">
          <span className="badge ok">Live ledger</span>
          <Link href="/pos">
            <button className="btn-primary">Open POS</button>
          </Link>
        </div>
      </div>

      <div className="cards2">
        <div>
          <div className="sc">Gross sales</div>
          <div className="v">{fmtIQD(gross)}</div>
          <div className="m">Across {days.length} trading day(s)</div>
        </div>
        <div>
          <div className="sc">Discounts</div>
          <div className="v red">({fmtIQD(discount)})</div>
          <div className="m">Merchant-funded</div>
        </div>
        <div>
          <div className="sc">Net revenue</div>
          <div className="v">{fmtIQD(net)}</div>
          <div className="m">Carried to 4000 Sales revenue</div>
        </div>
        <div>
          <div className="sc">Cost of sales</div>
          <div className="v">{fmtIQD(cogs)}</div>
          <div className="m">
            Margin {net > 0 ? (((net - cogs) / net) * 100).toFixed(1) : "0.0"}%
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <h3>Daily Sales Summaries</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            One line per day per channel — tickets stay in the POS
          </span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="No sales recorded yet"
            hint="Take a sale on the POS and the day appears here as a summary, ready to be closed off."
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Channel</th>
                  <th className="right">Orders</th>
                  <th className="right">Gross</th>
                  <th className="right">Discount</th>
                  <th className="right">Net</th>
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
                    <td className="right money">{fmtIQD(r.gross)}</td>
                    <td className="right money">{r.discount ? `(${fmtIQD(r.discount)})` : "—"}</td>
                    <td className="right money">{fmtIQD(r.net)}</td>
                    <td className="right money">{fmtIQD(r.cogs)}</td>
                    <td className="right">
                      <span className={`ref ${closedDays.has(r.day) ? "auto" : ""}`}>
                        {closedDays.has(r.day) ? "Closed" : "Open"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}>
          Each sale posts its own inventory movements as it happens, so stock is always live. The
          books read the day in summary — that is the level an accountant works at.
        </p>
      </section>

      <section className="panel">
        <div className="panel-h">
          <h3>Close the Day</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Count the drawer against what the till says it took
          </span>
        </div>
        <DayClose days={days.slice(0, 10)} expectedByDay={expectedByDay} />
      </section>

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
                  <th className="right">Till expected</th>
                  <th className="right">Counted</th>
                  <th className="right">Over / short</th>
                </tr>
              </thead>
              <tbody>
                {closes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.day}</td>
                    <td className="right money">{fmtIQD(c.expectedCash)}</td>
                    <td className="right money">{fmtIQD(c.countedCash)}</td>
                    <td
                      className="right money"
                      style={{ color: c.variance === 0 ? "var(--ok)" : "var(--err)" }}
                    >
                      {c.variance > 0 ? "+" : ""}
                      {fmtIQD(c.variance)}
                    </td>
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
