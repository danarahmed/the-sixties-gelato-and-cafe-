import { getT } from "@/lib/i18n/server";
import { getJournalEntries, getGlAccounts } from "@/lib/db/read";
import { getAccountingOverview } from "@/lib/db/accounting";
import { fmtIQD } from "@/lib/format";
import { JournalEntryForm } from "@/components/books/JournalEntryForm";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Where an entry came from, read off its reference type. */
const REF_LABEL: Record<string, string> = {
  sales_order: "POS",
  goods_receipt: "Purch",
  purchase_invoice: "Bill",
  supplier_payment: "Paymt",
  inventory_movement: "Stock",
  expense: "Auto",
  work_shift: "Close",
  manual: "Manual",
};

export default async function JournalsPage() {
  const t = await getT();
  const [entries, accounts, overview] = await Promise.all([
    getJournalEntries(60).catch(() => []),
    getGlAccounts().catch(() => []),
    getAccountingOverview().catch(() => null),
  ]);
  const locked = overview?.currentPeriodStatus === "locked";

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.journals")}</h1>
        <span className="sc">Manual double entry</span>
        <div className="sp">
          <span className={`badge ${overview?.trialBalanced ? "ok" : "err"}`}>
            {overview?.trialBalanced ? "Trial balance agrees" : "Out of balance"}
          </span>
          <span className={`badge ${locked ? "err" : ""}`}>
            {overview?.currentPeriodName ?? ""} {locked ? "locked" : "open"}
          </span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <h3>New Journal Voucher</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Debits must equal credits before it will post
          </span>
        </div>
        {locked ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {overview?.currentPeriodName} is locked — post a reversing entry in the next period
              instead.
            </p>
          </div>
        ) : (
          <JournalEntryForm accounts={accounts.map((a) => ({ code: a.code, name: a.name }))} />
        )}
      </section>

      <section className="panel">
        <div className="panel-h">
          <h3>Journal Register</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {entries.length} entries · every one balanced at commit
          </span>
        </div>
        {entries.length === 0 ? (
          <EmptyState
            title="No journal entries yet"
            hint="Sales, bills, payments, expenses and the day close all write here — as does anything you post by hand above."
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th>Ref</th>
                  <th className="right">Amount</th>
                  <th className="right">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const debit = e.lines.reduce((s, l) => s + l.debit, 0);
                  const credit = e.lines.reduce((s, l) => s + l.credit, 0);
                  const balanced = Math.round(debit) === Math.round(credit);
                  return (
                    <tr key={e.id}>
                      <td>{e.occurredAt.slice(0, 10)}</td>
                      <td>{e.description}</td>
                      <td>
                        <span className="ref auto">{REF_LABEL[e.description] ?? "Entry"}</span>
                      </td>
                      <td className="right money">{fmtIQD(debit)}</td>
                      <td className="right">
                        <span className={`ref ${balanced ? "auto" : "due"}`}>
                          {balanced ? "Posted" : "Unbalanced"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}>
          No posted entry may be edited or deleted — the database refuses it. Corrections are made by
          a reversing entry, so the history of the book stays intact.
        </p>
      </section>

      {entries.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <h3>Entry Detail</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Expand any entry to read its lines
            </span>
          </div>
          <div className="panel-b">
            {entries.slice(0, 12).map((e) => (
              <details key={e.id} style={{ borderBlockEnd: "1px solid var(--border)", padding: "7px 0" }}>
                <summary style={{ fontWeight: 600, fontSize: ".85rem" }}>
                  {e.description}{" "}
                  <span className="faint" style={{ fontWeight: 400 }}>
                    · {e.occurredAt.slice(0, 16).replace("T", " ")}
                  </span>
                </summary>
                <div className="voucher" style={{ marginBlockStart: 8, maxWidth: 520 }}>
                  {e.lines.map((l, i) => (
                    <div key={i} className={`vline ${l.credit > 0 ? "credit" : ""}`}>
                      <span className="dr">{l.debit > 0 ? "Dr" : "Cr"}</span>
                      <span className="acct">{l.account}</span>
                      <span className="amt">{fmtIQD(l.debit > 0 ? l.debit : l.credit)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
