import Link from "next/link";
import type { JournalLineRow } from "@/lib/db/reports";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import type { Msg, T } from "@/lib/i18n/core";

/** Where a journal came from, in words: phrases, shown through t(). */
const SOURCE: Record<string, string> = {
  sales_order: "Sale",
  sale_refund: "Refund",
  reversal: "Reversal",
  manual: "Manual journal",
  goods_receipt: "Delivery",
  purchase_invoice: "Supplier bill",
  supplier_payment: "Bill payment",
  expense: "Expense",
  inventory_movement: "Stock",
  stock_count: "Stock count",
  work_shift: "Drawer count",
  cash_transfer: "Cash moved",
  year_end_close: "Year-end close",
  correction: "Owner's correction",
};

function signed(n: number): string {
  if (n === 0) return "—";
  return n < 0 ? `(${fmtIQD(-n)})` : fmtIQD(n);
}

/**
 * The journal lines behind a figure (0026): an account's, or a few accounts',
 * for the dates asked. From the trial balance or the reconciliation the lines
 * run from the opening balance to the closing one; from the P&L they add up to
 * the P&L's figure, the year-end close left out as the P&L leaves it out.
 * A server component: the page gives it the reader's translators.
 */
export function AccountLedger({
  title,
  accounts,
  from,
  to,
  lines,
  more,
  opening,
  closing,
  pnl,
  revenue,
  timezone,
  t,
  msg,
}: {
  title: string;
  accounts: string[];
  from: string;
  to: string;
  lines: JournalLineRow[];
  more: boolean;
  /** Debit-positive, from the trial balance; null for a P&L figure. */
  opening: number | null;
  closing: number | null;
  pnl: boolean;
  /** A revenue figure reads credit less debit; anything else debit less credit. */
  revenue: boolean;
  timezone: string;
  t: T;
  /** The words the database writes (account names, narrations), in the reader's language. */
  msg: Msg;
}) {
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  const several = accounts.length !== 1;
  let balance = opening ?? 0;
  const csv = `/reports/export?report=journal_lines&from=${from}&to=${to}&account=${accounts.join(",")}${pnl ? "&pnl=1" : ""}`;

  return (
    <section className="panel" data-testid="account-ledger">
      <div className="panel-h">
        <h3>{title}</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          {pnl
            ? t("{from} to {to} · published entries · the year-end close left out, as on the P&L", {
                from,
                to,
              })
            : t("{from} to {to} · published entries", { from, to })}{" "}
          {/* i18n-ignore: CSV is the same in every language */}· <a href={csv}>CSV</a>
        </span>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("When")}</th>
              <th>{t("Journal #")}</th>
              {several && <th>{t("Account")}</th>}
              <th>{t("Narration")}</th>
              <th>{t("From")}</th>
              <th className="right">{t("Debit")}</th>
              <th className="right">{t("Credit")}</th>
              {!pnl && <th className="right">{t("Balance")}</th>}
            </tr>
          </thead>
          <tbody>
            {!pnl && (
              <tr>
                <td colSpan={several ? 5 : 4} className="muted">
                  {t("Opening balance")}
                </td>
                <td />
                <td />
                <td className="right money">{signed(opening ?? 0)}</td>
              </tr>
            )}
            {lines.length === 0 && (
              <tr>
                <td colSpan={several ? 8 : 7} className="muted" style={{ fontStyle: "italic" }}>
                  {t("Nothing posted in these dates.")}
                </td>
              </tr>
            )}
            {lines.map((l, i) => {
              balance += l.debit - l.credit;
              return (
                <tr key={`${l.entryId}-${i}`}>
                  <td className="mono muted" style={{ fontSize: ".8rem", whiteSpace: "nowrap" }}>
                    {dateTimeIn(timezone, l.occurredAt)}
                  </td>
                  <td className="mono">{l.journalNo ?? "—"}</td>
                  {several && (
                    <td className="faint">
                      {l.accountCode} {msg(l.accountName)}
                    </td>
                  )}
                  <td>
                    {msg(l.description)}
                    {l.memo ? <span className="muted"> · {l.memo}</span> : null}
                    {l.reversesJournalNo !== null && (
                      <span className="muted">
                        {" "}
                        · {t("reverses #{no}", { no: l.reversesJournalNo })}
                      </span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: ".85rem" }}>
                    {t(SOURCE[l.referenceType ?? ""] ?? l.referenceType ?? "—")}
                    {l.referenceNo ? ` ${l.referenceNo}` : ""}
                  </td>
                  <td className="right money">{l.debit ? fmtIQD(l.debit) : ""}</td>
                  <td className="right money">{l.credit ? fmtIQD(l.credit) : ""}</td>
                  {!pnl && <td className="right money">{signed(balance)}</td>}
                </tr>
              );
            })}
            <tr className="grand">
              <td colSpan={several ? 5 : 4}>
                {pnl
                  ? t("Total: {amount}", {
                      amount: fmtIQD(revenue ? credit - debit : debit - credit),
                    })
                  : t("Movement, and closing balance")}
              </td>
              <td className="right money">{fmtIQD(debit)}</td>
              <td className="right money">{fmtIQD(credit)}</td>
              {!pnl && <td className="right money">{signed(closing ?? balance)}</td>}
            </tr>
          </tbody>
        </table>
      </div>
      <p
        className="muted"
        style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
      >
        {more
          ? `${t("The first {n} lines are shown; the CSV has them all.", { n: lines.length })} `
          : `${t("{n} line(s).", { n: lines.length })} `}
        {t("Balances are debit-positive: a credit balance shows in brackets.")}{" "}
        <Link href="/journals">{t("Back to the journal register")}</Link>
      </p>
    </section>
  );
}
