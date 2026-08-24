import { getT } from "@/lib/i18n/server";
import { getExpenses } from "@/lib/db/books";
import { getAccountingOverview } from "@/lib/db/accounting";
import { fmtIQD } from "@/lib/format";
import { ExpenseEntry } from "@/components/books/ExpenseEntry";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const t = await getT();
  const [rows, overview] = await Promise.all([
    getExpenses(100).catch(() => []),
    getAccountingOverview().catch(() => null),
  ]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const locked = overview?.currentPeriodStatus === "locked";

  const byAccount = new Map<string, number>();
  for (const r of rows) byAccount.set(r.account, (byAccount.get(r.account) ?? 0) + r.amount);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.expenses")}</h1>
        <span className="sc">Rent · salaries · utilities · sundries</span>
        <div className="sp">
          <span className={`badge ${locked ? "err" : "ok"}`}>
            {overview?.currentPeriodName ?? ""} {locked ? "locked" : "open"}
          </span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <h3>Record an Expense</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            The account is proposed from the narration — reviewable before posting
          </span>
        </div>
        {locked ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              The period is locked. Corrections must be made by a reversing entry in the next period.
            </p>
          </div>
        ) : (
          <ExpenseEntry />
        )}
      </section>

      <section className="panel">
        <div className="panel-h">
          <h3>Expense Register</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {rows.length} recorded
          </span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="No expenses recorded yet"
            hint="Write the first one above — say what it was for and the account is proposed for you."
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Narration</th>
                  <th>Account</th>
                  <th>Ref</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{r.description}</td>
                    <td className="muted">{r.account}</td>
                    <td>
                      <span className={`ref ${r.hasJournal ? "auto" : ""}`}>
                        {r.hasJournal ? "Posted" : "Unposted"}
                      </span>
                    </td>
                    <td className="right money">{fmtIQD(r.amount)}</td>
                  </tr>
                ))}
                <tr className="grand">
                  <td />
                  <td>Total</td>
                  <td />
                  <td />
                  <td className="right money">{fmtIQD(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {byAccount.size > 0 && (
        <section className="panel">
          <div className="panel-h">
            <h3>By Account</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Where the money went
            </span>
          </div>
          <div className="panel-b">
            {[...byAccount.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([account, amount]) => (
                <div key={account} className="st-row">
                  <span className="lbl">{account}</span>
                  <span className="amt">{fmtIQD(amount)}</span>
                </div>
              ))}
            <div className="rule-single" />
            <div className="st-row total">
              <span className="lbl">Total</span>
              <span className="amt">{fmtIQD(total)}</span>
            </div>
            <div className="rule-double" />
          </div>
        </section>
      )}
    </div>
  );
}
