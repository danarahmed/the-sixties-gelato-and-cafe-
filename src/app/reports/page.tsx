import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getDailySales, getVendorBook, ageBills } from "@/lib/db/books";
import {
  getLegacyUnposted,
  getMenuCosting,
  getProfitAndLoss,
  getReconciliation,
  getUncostedSales,
  pnlTotals,
} from "@/lib/db/reports";
import { LegacyPostings } from "@/components/books/LegacyPostings";
import { channelLabel, fmtIQD } from "@/lib/format";
import {
  addDays,
  businessToday,
  dateTimeIn,
  monthEnd,
  monthStart,
  parseDay,
  yearStart,
} from "@/lib/dates";
import type { SalesChannel } from "@domain/sales/recipe.js";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const from = parseDay(sp.from, monthStart(today));
  const to = parseDay(sp.to, today);
  const seesProfit = has(profile, "profit.view");

  const [pnl, rec, sales, book, menu, unposted, uncosted] = await Promise.all([
    seesProfit ? getProfitAndLoss(from, to) : Promise.resolve([]),
    getReconciliation(to),
    getDailySales(from, to),
    getVendorBook(today),
    getMenuCosting(),
    getLegacyUnposted(),
    getUncostedSales(from, to),
  ]);
  const uncostedNet = uncosted.reduce((sum, u) => sum + u.net, 0);
  const totals = pnlTotals(pnl);
  const ageing = ageBills(book.openBills);
  const unreconciled = rec.filter((r) => r.difference !== 0);

  const byChannel = new Map<string, { orders: number; net: number; cogs: number }>();
  for (const r of sales) {
    const cur = byChannel.get(r.channel) ?? { orders: 0, net: 0, cogs: 0 };
    byChannel.set(r.channel, {
      orders: cur.orders + r.orders,
      net: cur.net + r.net,
      cogs: cur.cogs + r.cogs,
    });
  }

  const lastMonthEnd = addDays(monthStart(today), -1);
  const ranges: [string, string, string][] = [
    ["This month", monthStart(today), today],
    ["Last month", monthStart(lastMonthEnd), monthEnd(lastMonthEnd)],
    ["This year", yearStart(today), today],
  ];
  const section = (s: string) => pnl.filter((r) => r.section === s && r.amount !== 0);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.reports")}</h1>
        <span className="sc">
          {from} to {to} · from the ledger
        </span>
      </div>

      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">From</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="sc">To</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit">Show</button>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ranges.map(([label, f, tt]) => (
            <Link key={label} className="badge" href={`/reports?from=${f}&to=${tt}`}>
              {label}
            </Link>
          ))}
        </span>
      </form>

      {/* ---- Reconciliation ---- */}
      <section className="panel" id="reconciliation">
        <div className="panel-h">
          <h3>Do the books tie?</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Each subledger against its control account, as at the end of {to} ·{" "}
            <a href={`/reports/export?report=reconciliation&to=${to}`}>CSV</a>
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Check</th>
                <th className="right">Subledger</th>
                <th className="right">Ledger</th>
                <th className="right">Difference</th>
              </tr>
            </thead>
            <tbody>
              {rec.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.difference === 0 ? "✅ " : "⛔ "}
                    {r.label}
                  </td>
                  <td className="right money">{fmtIQD(r.subledger)}</td>
                  <td className="right money">{fmtIQD(r.ledger)}</td>
                  <td className={`right money ${r.difference !== 0 ? "red" : ""}`}>
                    {fmtIQD(r.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p
          className="muted"
          style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
        >
          {unreconciled.length === 0
            ? "Every subledger agrees with its control account."
            : `${unreconciled.length} difference(s). A period cannot be locked while its checks fail. Differences that predate the controls are explained in docs/REMEDIATION.md and are corrected by new, dated entries — reversals, cancelled bills, the owner's corrections — never by editing history.`}
        </p>
        <LegacyPostings
          records={unposted}
          canPost={has(profile, "accounting.period.unlock")}
          timezone={profile.timezone}
        />
      </section>

      {/* ---- Profit & Loss ---- */}
      {seesProfit && (
        <section className="panel" id="pnl">
          <div className="panel-h">
            <h3>Profit &amp; Loss</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Published journal lines, {from} to {to} ·{" "}
              <a href={`/reports/export?report=pnl&from=${from}&to=${to}`}>CSV</a>
            </span>
          </div>
          <div className="panel-b" style={{ maxWidth: 640 }}>
            <div className="st-row group">
              <span className="lbl">Income</span>
              <span className="amt" />
            </div>
            {section("revenue").map((r) => (
              <div key={r.code} className="st-row indent">
                <span className="lbl">
                  {r.code} {r.name}
                </span>
                <span className={`amt ${r.amount < 0 ? "red" : ""}`}>{fmtIQD(r.amount)}</span>
              </div>
            ))}
            <div className="st-row total">
              <span className="lbl">Net revenue</span>
              <span className="amt">{fmtIQD(totals.revenue)}</span>
            </div>
            <div className="st-row group">
              <span className="lbl">Cost of sales</span>
              <span className="amt" />
            </div>
            {section("cost_of_sales").map((r) => (
              <div key={r.code} className="st-row indent">
                <span className="lbl">
                  {r.code} {r.name}
                </span>
                <span className="amt red">({fmtIQD(r.amount)})</span>
              </div>
            ))}
            <div className="rule-single" />
            <div className="st-row total">
              <span className="lbl">Gross profit</span>
              <span className="amt">{fmtIQD(totals.grossProfit)}</span>
            </div>
            <div className="st-row group">
              <span className="lbl">Operating expenses</span>
              <span className="amt" />
            </div>
            {section("operating_expenses").map((r) => (
              <div key={r.code} className="st-row indent">
                <span className="lbl">
                  {r.code} {r.name}
                </span>
                <span className="amt red">({fmtIQD(r.amount)})</span>
              </div>
            ))}
            <div className="st-row total" style={{ marginBlockStart: 10 }}>
              <span className="lbl">Net {totals.net < 0 ? "loss" : "profit"}</span>
              <span className={`amt ${totals.net < 0 ? "red" : ""}`}>{fmtIQD(totals.net)}</span>
            </div>
            <div className="rule-double" />
          </div>
        </section>
      )}

      {/* ---- Sales by channel ---- */}
      <section className="panel" id="channel">
        <div className="panel-h">
          <h3>Sales by Channel</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Recorded sales, {from} to {to}, voids excluded
          </span>
        </div>
        {byChannel.size === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              No sales in these dates.
            </p>
          </div>
        ) : (
          <div className="tw">
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
                    <td>
                      <span className="ref">{channelLabel[c as SalesChannel] ?? c}</span>
                    </td>
                    <td className="right money">{v.orders}</td>
                    <td className="right money">{fmtIQD(v.net)}</td>
                    <td className="right money">{fmtIQD(v.net - v.cogs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Sales costed at nothing (0025) ---- */}
      <section className="panel" id="uncosted">
        <div className="panel-h">
          <h3>Uncosted Sales</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Sales {from} to {to} with no cost, or part of it missing
          </span>
        </div>
        {uncosted.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              ✅ Every sale in these dates carries its cost.
            </p>
          </div>
        ) : (
          <>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Products</th>
                    <th>Channel</th>
                    <th className="right">Net sales</th>
                    <th className="right">Cost recorded</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {uncosted.map((u) => (
                    <tr key={u.orderId}>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>
                        {dateTimeIn(profile.timezone, u.placedAt)}
                      </td>
                      <td>{u.products}</td>
                      <td>
                        <span className="ref">
                          {channelLabel[u.channel as SalesChannel] ?? u.channel}
                        </span>
                      </td>
                      <td className="right money">{fmtIQD(u.net)}</td>
                      <td className="right money">{fmtIQD(u.cogs)}</td>
                      <td style={{ fontSize: ".82rem", color: "var(--warn)" }}>{u.reasons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p
              className="muted"
              style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
            >
              ⚠️ {uncosted.length} sale(s), {fmtIQD(uncostedNet)} of sales: their profit is
              overstated by what went into them uncosted. A sale keeps the cost it was recorded
              with. To cost the next ones, give the product its recipe on{" "}
              <Link href="/products">Products</Link> (or say why it uses no stock), and give an item
              with no cost its opening stock or its first delivery on{" "}
              <Link href="/inventory">Inventory</Link>.
            </p>
          </>
        )}
      </section>

      {/* ---- Payable ageing ---- */}
      <section className="panel" id="ageing">
        <div className="panel-h">
          <h3>Payable Ageing</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Today · what to pay first
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Invoice</th>
                <th>Due</th>
                <th className="right">Outstanding</th>
                <th className="right">Age</th>
              </tr>
            </thead>
            <tbody>
              {book.openBills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ fontStyle: "italic" }}>
                    Nothing outstanding — every bill is settled.
                  </td>
                </tr>
              ) : (
                book.openBills.map((b) => (
                  <tr key={b.id}>
                    <td>{b.supplierName}</td>
                    <td>{b.invoiceNo || "—"}</td>
                    <td>{b.dueDate ?? "—"}</td>
                    <td className="right money">{fmtIQD(b.outstanding)}</td>
                    <td className="right">
                      <span className={`ref ${b.daysOverdue > 0 ? "due" : ""}`}>
                        {b.daysOverdue > 0 ? `${b.daysOverdue}d over` : "Current"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
              {book.openBills.length > 0 && (
                <tr className="grand">
                  <td />
                  <td>Total payable</td>
                  <td />
                  <td className="right money">{fmtIQD(ageing.total)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Product margin ---- */}
      <section className="panel" id="margin">
        <div className="panel-h">
          <h3>Product Margin by Channel</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Today&apos;s prices and today&apos;s costs, costed exactly as a sale posts them
          </span>
        </div>
        {menu.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              Add products with recipes and prices to see their margins.
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Channel</th>
                  <th className="right">Price</th>
                  <th className="right">Cost</th>
                  <th className="right">Margin</th>
                  <th className="right">%</th>
                </tr>
              </thead>
              <tbody>
                {menu.map((m) => {
                  const margin = m.unitCost === null ? null : m.price - m.unitCost;
                  return (
                    <tr key={m.variantId + m.channel}>
                      <td>
                        {m.productName}
                        {m.variantName !== m.productName ? ` — ${m.variantName}` : ""}
                      </td>
                      <td>
                        <span className="ref">
                          {channelLabel[m.channel as SalesChannel] ?? m.channel}
                        </span>
                      </td>
                      <td className="right money">{fmtIQD(m.price)}</td>
                      <td className="right money">
                        {m.unitCost === null ? "unknown" : fmtIQD(m.unitCost)}
                      </td>
                      <td className={`right money ${margin !== null && margin < 0 ? "red" : ""}`}>
                        {margin === null ? "—" : fmtIQD(margin)}
                      </td>
                      <td className="right money">
                        {margin === null || m.price <= 0
                          ? "—"
                          : `${((margin / m.price) * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted" style={{ fontSize: ".78rem" }}>
        Also: <Link href="/accounting">Trial balance</Link> ·{" "}
        <Link href="/journals">Journal register</Link> ·{" "}
        <Link href="/sales">Daily sales &amp; cash over/short</Link> ·{" "}
        <Link href="/vendors">Vendor statements</Link> ·{" "}
        <Link href="/inventory">Stock valuation</Link> · <Link href="/count">Count variances</Link>.
        Not built yet: balance sheet, cash-flow statement, sales by hour.
      </p>
    </div>
  );
}
