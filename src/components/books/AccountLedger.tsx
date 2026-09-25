import Link from "next/link";
import type { JournalLineRow } from "@/lib/db/reports";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";

/** Where a journal came from, in words. */
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
          {from} to {to} · published entries
          {pnl ? " · the year-end close left out, as on the P&L" : ""} · <a href={csv}>CSV</a>
        </span>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Journal #</th>
              {several && <th>Account</th>}
              <th>Narration</th>
              <th>From</th>
              <th className="right">Debit</th>
              <th className="right">Credit</th>
              {!pnl && <th className="right">Balance</th>}
            </tr>
          </thead>
          <tbody>
            {!pnl && (
              <tr>
                <td colSpan={several ? 5 : 4} className="muted">
                  Opening balance
                </td>
                <td />
                <td />
                <td className="right money">{signed(opening ?? 0)}</td>
              </tr>
            )}
            {lines.length === 0 && (
              <tr>
                <td colSpan={several ? 8 : 7} className="muted" style={{ fontStyle: "italic" }}>
                  Nothing posted in these dates.
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
                      {l.accountCode} {l.accountName}
                    </td>
                  )}
                  <td>
                    {l.description}
                    {l.memo ? <span className="muted"> · {l.memo}</span> : null}
                    {l.reversesJournalNo !== null && (
                      <span className="muted"> · reverses #{l.reversesJournalNo}</span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: ".85rem" }}>
                    {SOURCE[l.referenceType ?? ""] ?? l.referenceType ?? "—"}
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
                  ? `Total: ${fmtIQD(revenue ? credit - debit : debit - credit)}`
                  : "Movement, and closing balance"}
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
          ? `The first ${lines.length} lines are shown; the CSV has them all. `
          : `${lines.length} line(s). `}
        Balances are debit-positive: a credit balance shows in brackets.{" "}
        <Link href="/journals">Back to the journal register</Link>
      </p>
    </section>
  );
}
