import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getDailySales, getVendorBook, ageBills, salesTotals } from "@/lib/db/books";
import {
  getExceptions,
  getLegacyUnposted,
  getMenuCosting,
  getProfitAndLoss,
  getReconciliation,
  getUncostedSales,
  pnlTotals,
} from "@/lib/db/reports";
import { LegacyPostings } from "@/components/books/LegacyPostings";
import { EXCEPTION_LABEL, exceptionsByPerson, type ExceptionKind } from "@/lib/exceptions";
import { fmtIQD } from "@/lib/format";
import { getChannelNames } from "@/lib/db/channels";
import {
  addDays,
  businessToday,
  dateTimeIn,
  monthEnd,
  monthStart,
  parseDay,
  yearStart,
} from "@/lib/dates";

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
  const seesExceptions = has(profile, "audit.view");

  const [pnl, rec, sales, book, allMenu, unposted, uncosted, exceptions, channels] =
    await Promise.all([
      seesProfit ? getProfitAndLoss(from, to) : Promise.resolve([]),
      getReconciliation(to),
      getDailySales(from, to),
      getVendorBook(today),
      getMenuCosting(),
      getLegacyUnposted(),
      getUncostedSales(from, to),
      seesExceptions ? getExceptions(from, to) : Promise.resolve([]),
      getChannelNames(),
    ]);
  // The menu as it sells today: a platform out of use sells nothing.
  const menu = allMenu.filter((m) =>
    channels.channels.some((c) => c.code === m.channel && c.active),
  );
  const byPerson = exceptionsByPerson(exceptions);
  const toReview = exceptions.filter((e) => e.needsReview).length;
  const kinds = Object.keys(EXCEPTION_LABEL) as ExceptionKind[];
  const uncostedNet = uncosted.reduce((sum, u) => sum + u.net, 0);
  const totals = pnlTotals(pnl);
  const ageing = ageBills(book.openBills);
  const unreconciled = rec.filter((r) => r.difference !== 0);

  const byChannel = new Map<string, typeof sales>();
  for (const r of sales) byChannel.set(r.channel, [...(byChannel.get(r.channel) ?? []), r]);
  const allChannels = salesTotals(sales);
  // Each reconciliation line opens its two sides: the records, and the ledger.
  const recLinks: Record<string, { records: string; accounts: string }> = {
    inventory: { records: "/inventory", accounts: "1200" },
    payables: { records: "/vendors", accounts: "2000" },
    grni: { records: "/purchasing", accounts: "2050" },
    sales: { records: `/orders?from=${monthStart(to)}&to=${to}`, accounts: "4000,4100,4200" },
  };
  const ledger = (accounts: string, f: string, tt: string, pnl = false) =>
    `/journals?account=${accounts}&from=${f}&to=${tt}${pnl ? "&pnl=1" : ""}`;

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
          {from} to {to} · from the ledger ·{" "}
          <a href={`/reports/export?report=journal_lines&from=${from}&to=${to}`}>
            every journal line (CSV)
          </a>
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
                  <td className="right money">
                    {recLinks[r.key] ? (
                      <Link className="drill" href={recLinks[r.key]!.records}>
                        {fmtIQD(r.subledger)}
                      </Link>
                    ) : (
                      fmtIQD(r.subledger)
                    )}
                  </td>
                  <td className="right money">
                    {recLinks[r.key] ? (
                      <Link
                        className="drill"
                        href={ledger(recLinks[r.key]!.accounts, monthStart(to), to)}
                      >
                        {fmtIQD(r.ledger)}
                      </Link>
                    ) : (
                      fmtIQD(r.ledger)
                    )}
                  </td>
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
                  <Link className="drill" href={ledger(r.code, from, to, true)}>
                    {r.code} {r.name}
                  </Link>
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
                  <Link className="drill" href={ledger(r.code, from, to, true)}>
                    {r.code} {r.name}
                  </Link>
                </span>
                <span className="amt red">({fmtIQD(r.amount)})</span>
              </div>
            ))}
            <div className="rule-single" />
            <div className="st-row total">
              <span className="lbl">Gross profit after waste &amp; fees</span>
              <span className="amt">{fmtIQD(totals.grossProfit)}</span>
            </div>
            <div className="st-row group">
              <span className="lbl">Operating expenses</span>
              <span className="amt" />
            </div>
            {section("operating_expenses").map((r) => (
              <div key={r.code} className="st-row indent">
                <span className="lbl">
                  <Link className="drill" href={ledger(r.code, from, to, true)}>
                    {r.code} {r.name}
                  </Link>
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
            Sales {from} to {to}, voids excluded; refunds on the day they were made
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
                  <th className="right">Sales</th>
                  <th className="right">Refunds</th>
                  <th className="right">Net sales</th>
                  <th className="right">Sales margin</th>
                </tr>
              </thead>
              <tbody>
                {[...byChannel.entries()].map(([c, list]) => {
                  const v = salesTotals(list);
                  return (
                    <tr key={c}>
                      <td>
                        <span className="ref">{channels.name(c)}</span>
                      </td>
                      <td className="right money">
                        <Link
                          className="drill"
                          href={`/orders?from=${from}&to=${to}&channel=${encodeURIComponent(c)}`}
                        >
                          {list.reduce((s, r) => s + r.orders, 0)}
                        </Link>
                      </td>
                      <td className="right money">{fmtIQD(v.sold)}</td>
                      <td className="right money">{v.refunds ? `(${fmtIQD(v.refunds)})` : "—"}</td>
                      <td className="right money">{fmtIQD(v.net)}</td>
                      <td className="right money">{fmtIQD(v.margin)}</td>
                    </tr>
                  );
                })}
                <tr className="grand">
                  <td>All channels</td>
                  <td className="right money">{sales.reduce((s, r) => s + r.orders, 0)}</td>
                  <td className="right money">{fmtIQD(allChannels.sold)}</td>
                  <td className="right money">
                    {allChannels.refunds ? `(${fmtIQD(allChannels.refunds)})` : "—"}
                  </td>
                  <td className="right money">{fmtIQD(allChannels.net)}</td>
                  <td className="right money">{fmtIQD(allChannels.margin)}</td>
                </tr>
              </tbody>
            </table>
            <p
              className="muted"
              style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
            >
              Net sales are what the P&amp;L shows as net revenue for the same dates (4000 less 4100
              and 4200). The sales margin is net sales less the recipe cost of what was sold; the
              P&amp;L&apos;s gross profit also takes off waste, count differences, purchase price
              differences and platform fees.
            </p>
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
                        <span className="ref">{channels.name(u.channel)}</span>
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

      {/* ---- Exceptions, by person (0028) ---- */}
      {seesExceptions && (
        <section className="panel" id="exceptions" data-testid="exceptions">
          <div className="panel-h">
            <h3>Exceptions</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Voids, refunds, discounts, cancelled bills, items taken off bills and wrong PINs,{" "}
              {from} to {to} ·{" "}
              <a href={`/reports/export?report=exceptions&from=${from}&to=${to}`}>CSV</a>
            </span>
          </div>
          {exceptions.length === 0 ? (
            <div className="panel-b">
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                ✅ Nothing was voided, refunded, discounted, cancelled or taken off a bill in these
                dates.
              </p>
            </div>
          ) : (
            <>
              <div className="tw">
                <table data-testid="exceptions-by-person">
                  <thead>
                    <tr>
                      <th>Person</th>
                      {kinds.map((k) => (
                        <th key={k} className="right">
                          {EXCEPTION_LABEL[k]}
                        </th>
                      ))}
                      <th className="right">Money involved</th>
                      <th className="right">For review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPerson.map((p) => (
                      <tr key={p.person}>
                        <td>{p.person}</td>
                        {kinds.map((k) => (
                          <td key={k} className="right mono">
                            {p.counts[k] ?? "—"}
                          </td>
                        ))}
                        <td className="right money">{fmtIQD(p.amount)}</td>
                        <td
                          className="right mono"
                          style={{ color: p.review > 0 ? "var(--warn)" : undefined }}
                        >
                          {p.review || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tw">
                <table data-testid="exceptions-list">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>What</th>
                      <th>Who</th>
                      <th className="right">Amount</th>
                      <th>Why</th>
                      <th>Approved by</th>
                      <th>About</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((e, i) => (
                      <tr key={i} data-kind={e.kind} data-review={e.needsReview ? "1" : "0"}>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {dateTimeIn(profile.timezone, e.at)}
                        </td>
                        <td>
                          {EXCEPTION_LABEL[e.kind] ?? e.kind}
                          {e.needsReview && (
                            <span className="badge warn" style={{ marginInlineStart: 6 }}>
                              review
                            </span>
                          )}
                        </td>
                        <td>{e.person ?? "—"}</td>
                        <td className="right money">
                          {e.amount === null ? "—" : fmtIQD(e.amount)}
                        </td>
                        <td style={{ fontSize: ".82rem" }}>{e.reason ?? "—"}</td>
                        <td>{e.approvedBy ?? "—"}</td>
                        <td className="muted" style={{ fontSize: ".78rem" }}>
                          {e.reference}
                          {e.detail ? ` · ${e.detail}` : ""}
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
                {toReview > 0 ? `⚠️ ${toReview} wait for your review: ` : ""}a void or refund nobody
                else approved, a wrong PIN, or a discount over the cap given before discounts were
                checked. Discounts over the cap need a manager&apos;s approval on the till; a void
                or refund may be approved there by a second person with their name and PIN.
              </p>
            </>
          )}
        </section>
      )}

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
                        <span className="ref">{channels.name(m.channel)}</span>
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
