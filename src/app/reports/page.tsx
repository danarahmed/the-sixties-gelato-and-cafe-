import Link from "next/link";
import { getMsg, getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
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
import { EXCEPTION_LABEL, NO_ONE, exceptionsByPerson, type ExceptionKind } from "@/lib/exceptions";
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
  const msg = await getMsg();
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
          <Rich
            text={t("{from} to {to} · from the ledger · <csv>every journal line (CSV)</csv>", {
              from,
              to,
            })}
            tags={{
              csv: (c) => (
                <a href={`/reports/export?report=journal_lines&from=${from}&to=${to}`}>{c}</a>
              ),
            }}
          />
        </span>
      </div>

      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">{t("From")}</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="sc">{t("To")}</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit">{t("Show")}</button>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ranges.map(([label, f, tt]) => (
            <Link key={label} className="badge" href={`/reports?from=${f}&to=${tt}`}>
              {t(label)}
            </Link>
          ))}
        </span>
      </form>

      {/* ---- Reconciliation ---- */}
      <section className="panel" id="reconciliation">
        <div className="panel-h">
          <h3>{t("Do the books tie?")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            <Rich
              text={t(
                "Each subledger against its control account, as at the end of {to} · <csv>CSV</csv>",
                { to },
              )}
              tags={{
                csv: (c) => <a href={`/reports/export?report=reconciliation&to=${to}`}>{c}</a>,
              }}
            />
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{t("Check")}</th>
                <th className="right">{t("Subledger")}</th>
                <th className="right">{t("Ledger")}</th>
                <th className="right">{t("Difference")}</th>
              </tr>
            </thead>
            <tbody>
              {rec.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.difference === 0 ? "✅ " : "⛔ "}
                    {msg(r.label)}
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
            ? t("Every subledger agrees with its control account.")
            : t(
                "{n} difference(s). A period cannot be locked while its checks fail. Differences that predate the controls are explained in docs/REMEDIATION.md and are corrected by new, dated entries — reversals, cancelled bills, the owner's corrections — never by editing history.",
                { n: unreconciled.length },
              )}
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
            <h3>{t("Profit & Loss")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              <Rich
                text={t("Published journal lines, {from} to {to} · <csv>CSV</csv>", { from, to })}
                tags={{
                  csv: (c) => <a href={`/reports/export?report=pnl&from=${from}&to=${to}`}>{c}</a>,
                }}
              />
            </span>
          </div>
          <div className="panel-b" style={{ maxWidth: 640 }}>
            <div className="st-row group">
              <span className="lbl">{t("Income")}</span>
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
              <span className="lbl">{t("Net revenue")}</span>
              <span className="amt">{fmtIQD(totals.revenue)}</span>
            </div>
            <div className="st-row group">
              <span className="lbl">{t("Cost of sales")}</span>
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
              <span className="lbl">{t("dash.grossProfit")}</span>
              <span className="amt">{fmtIQD(totals.grossProfit)}</span>
            </div>
            <div className="st-row group">
              <span className="lbl">{t("Operating expenses")}</span>
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
              <span className="lbl">{totals.net < 0 ? t("Net loss") : t("Net profit")}</span>
              <span className={`amt ${totals.net < 0 ? "red" : ""}`}>{fmtIQD(totals.net)}</span>
            </div>
            <div className="rule-double" />
          </div>
        </section>
      )}

      {/* ---- Sales by channel ---- */}
      <section className="panel" id="channel">
        <div className="panel-h">
          <h3>{t("Sales by Channel")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Sales {from} to {to}, voids excluded; refunds on the day they were made", {
              from,
              to,
            })}
          </span>
        </div>
        {byChannel.size === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("No sales in these dates.")}
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Channel")}</th>
                  <th className="right">{t("Orders")}</th>
                  <th className="right">{t("Sales")}</th>
                  <th className="right">{t("Refunds")}</th>
                  <th className="right">{t("Net sales")}</th>
                  <th className="right">{t("Sales margin")}</th>
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
                  <td>{t("All channels")}</td>
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
              {t(
                "Net sales are what the P&L shows as net revenue for the same dates (4000 less 4100 and 4200). The sales margin is net sales less the recipe cost of what was sold; the P&L's gross profit also takes off waste, count differences, purchase price differences and platform fees.",
              )}
            </p>
          </div>
        )}
      </section>

      {/* ---- Sales costed at nothing (0025) ---- */}
      <section className="panel" id="uncosted">
        <div className="panel-h">
          <h3>{t("Uncosted Sales")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Sales {from} to {to} with no cost, or part of it missing", { from, to })}
          </span>
        </div>
        {uncosted.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              ✅ {t("Every sale in these dates carries its cost.")}
            </p>
          </div>
        ) : (
          <>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>{t("When")}</th>
                    <th>{t("Products")}</th>
                    <th>{t("Channel")}</th>
                    <th className="right">{t("Net sales")}</th>
                    <th className="right">{t("Cost recorded")}</th>
                    <th>{t("Why")}</th>
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
                      <td style={{ fontSize: ".82rem", color: "var(--warn)" }}>{msg(u.reasons)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p
              className="muted"
              style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
            >
              ⚠️{" "}
              <Rich
                text={t(
                  "{n} sale(s), {amount} of sales: their profit is overstated by what went into them uncosted. A sale keeps the cost it was recorded with. To cost the next ones, give the product its recipe on <products>Products</products> (or say why it uses no stock), and give an item with no cost its opening stock or its first delivery on <inventory>Inventory</inventory>.",
                  { n: uncosted.length, amount: fmtIQD(uncostedNet) },
                )}
                tags={{
                  products: (c) => <Link href="/products">{c}</Link>,
                  inventory: (c) => <Link href="/inventory">{c}</Link>,
                }}
              />
            </p>
          </>
        )}
      </section>

      {/* ---- Exceptions, by person (0028) ---- */}
      {seesExceptions && (
        <section className="panel" id="exceptions" data-testid="exceptions">
          <div className="panel-h">
            <h3>{t("Exceptions")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              <Rich
                text={t(
                  "Voids, refunds, discounts, cancelled bills, items taken off bills and wrong PINs, {from} to {to} · <csv>CSV</csv>",
                  { from, to },
                )}
                tags={{
                  csv: (c) => (
                    <a href={`/reports/export?report=exceptions&from=${from}&to=${to}`}>{c}</a>
                  ),
                }}
              />
            </span>
          </div>
          {exceptions.length === 0 ? (
            <div className="panel-b">
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                ✅{" "}
                {t(
                  "Nothing was voided, refunded, discounted, cancelled or taken off a bill in these dates.",
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="tw">
                <table data-testid="exceptions-by-person">
                  <thead>
                    <tr>
                      <th>{t("Person")}</th>
                      {kinds.map((k) => (
                        <th key={k} className="right">
                          {t(EXCEPTION_LABEL[k])}
                        </th>
                      ))}
                      <th className="right">{t("Money involved")}</th>
                      <th className="right">{t("For review")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPerson.map((p) => (
                      <tr key={p.person}>
                        <td>{p.person === NO_ONE ? t(NO_ONE) : p.person}</td>
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
                      <th>{t("When")}</th>
                      <th>{t("What")}</th>
                      <th>{t("Who")}</th>
                      <th className="right">{t("Amount")}</th>
                      <th>{t("Why")}</th>
                      <th>{t("Approved by")}</th>
                      <th>{t("About")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((e, i) => (
                      <tr key={i} data-kind={e.kind} data-review={e.needsReview ? "1" : "0"}>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {dateTimeIn(profile.timezone, e.at)}
                        </td>
                        <td>
                          {t(EXCEPTION_LABEL[e.kind] ?? e.kind)}
                          {e.needsReview && (
                            <span className="badge warn" style={{ marginInlineStart: 6 }}>
                              {t("review")}
                            </span>
                          )}
                        </td>
                        <td>{e.person ?? "—"}</td>
                        <td className="right money">
                          {e.amount === null ? "—" : fmtIQD(e.amount)}
                        </td>
                        <td style={{ fontSize: ".82rem" }}>{msg(e.reason ?? "—")}</td>
                        <td>{e.approvedBy ?? "—"}</td>
                        <td className="muted" style={{ fontSize: ".78rem" }}>
                          {msg(e.detail ? `${e.reference} · ${e.detail}` : e.reference)}
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
                {toReview > 0
                  ? `⚠️ ${t(
                      "{n} wait for your review: a void or refund nobody else approved, a wrong PIN, or a discount over the cap given before discounts were checked. Discounts over the cap need a manager's approval on the till; a void or refund may be approved there by a second person with their name and PIN.",
                      { n: toReview },
                    )}`
                  : t(
                      "a void or refund nobody else approved, a wrong PIN, or a discount over the cap given before discounts were checked. Discounts over the cap need a manager's approval on the till; a void or refund may be approved there by a second person with their name and PIN.",
                    )}
              </p>
            </>
          )}
        </section>
      )}

      {/* ---- Payable ageing ---- */}
      <section className="panel" id="ageing">
        <div className="panel-h">
          <h3>{t("Payable Ageing")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Today · what to pay first")}
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{t("Vendor")}</th>
                <th>{t("Invoice")}</th>
                <th>{t("Due")}</th>
                <th className="right">{t("Outstanding")}</th>
                <th className="right">{t("Age")}</th>
              </tr>
            </thead>
            <tbody>
              {book.openBills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ fontStyle: "italic" }}>
                    {t("Nothing outstanding — every bill is settled.")}
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
                        {b.daysOverdue > 0 ? t("{n}d over", { n: b.daysOverdue }) : t("Current")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
              {book.openBills.length > 0 && (
                <tr className="grand">
                  <td />
                  <td>{t("Total payable")}</td>
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
          <h3>{t("Product Margin by Channel")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Today's prices and today's costs, costed exactly as a sale posts them")}
          </span>
        </div>
        {menu.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("Add products with recipes and prices to see their margins.")}
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Product")}</th>
                  <th>{t("Channel")}</th>
                  <th className="right">{t("Price")}</th>
                  <th className="right">{t("Cost")}</th>
                  <th className="right">{t("Margin")}</th>
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
                        {m.unitCost === null ? t("unknown") : fmtIQD(m.unitCost)}
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
        {t("Also:")} <Link href="/accounting">{t("Trial balance")}</Link> ·{" "}
        <Link href="/journals">{t("Journal register")}</Link> ·{" "}
        <Link href="/sales">{t("Daily sales & cash over/short")}</Link> ·{" "}
        <Link href="/vendors">{t("Vendor statements")}</Link> ·{" "}
        <Link href="/inventory">{t("Stock valuation")}</Link> ·{" "}
        <Link href="/count">{t("Count variances")}</Link>.{" "}
        {t("Not built yet: balance sheet, cash-flow statement, sales by hour.")}
      </p>
    </div>
  );
}
