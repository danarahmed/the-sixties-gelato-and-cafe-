import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getExpenses, getGlAccounts, getPeriods, periodFor } from "@/lib/db/books";
import { fmtIQD } from "@/lib/format";
import { businessToday } from "@/lib/dates";
import { ExpenseEntry } from "@/components/books/ExpenseEntry";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Stock costs come from their own records, never from a typed-in expense. */
const NOT_EXPENSES = new Set(["5000", "5050", "5300", "5400"]);

export default async function ExpensesPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const [rows, accounts, periods] = await Promise.all([
    getExpenses(100),
    getGlAccounts(),
    getPeriods(),
  ]);
  const period = periodFor(periods, today);
  const locked = period?.status === "locked";
  // A reversed expense stays listed, marked, but is no longer spent (audit P1-2).
  const live = rows.filter((r) => r.reversedBy === null);
  const total = live.reduce((s, r) => s + r.amount, 0);
  const reversed = rows.length - live.length;

  const byAccount = new Map<string, number>();
  for (const r of live) byAccount.set(r.account, (byAccount.get(r.account) ?? 0) + r.amount);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.expenses")}</h1>
        <span className="sc">{t("Rent · salaries · utilities · sundries")}</span>
        <div className="sp">
          {period && (
            <span className={`badge ${locked ? "err" : "ok"}`}>
              {period.name} {locked ? t("locked") : t("open")}
            </span>
          )}
        </div>
      </div>

      {has(profile, "expense.record") && (
        <section className="panel">
          <div className="panel-h">
            <h3>{t("Record an Expense")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("The account is proposed from the narration — you confirm it before posting")}
            </span>
          </div>
          <ExpenseEntry
            accounts={accounts
              .filter((a) => a.isActive && a.type === "expense" && !NOT_EXPENSES.has(a.code))
              .map((a) => ({ code: a.code, name: a.name }))}
            today={today}
          />
        </section>
      )}

      <section className="panel">
        <div className="panel-h">
          <h3>{t("Expense Register")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Last {n}", { n: rows.length })}
          </span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={t("No expenses recorded yet")}
            hint={t("Record the first one above.")}
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Date")}</th>
                  <th>{t("Narration")}</th>
                  <th>{t("Account")}</th>
                  <th>{t("Journal")}</th>
                  <th>{t("By")}</th>
                  <th className="right">{t("Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.reversedBy !== null ? "muted" : undefined}>
                    <td>{r.date}</td>
                    <td>
                      {r.description}
                      {r.reversedBy !== null && (
                        <span className="badge warn" style={{ marginInlineStart: 6 }}>
                          {t("reversed by #{no}", { no: r.reversedBy })}
                        </span>
                      )}
                    </td>
                    <td className="muted">{r.account}</td>
                    <td className="mono">{r.journalNo ?? "—"}</td>
                    <td className="muted">{r.by ?? "—"}</td>
                    <td
                      className="right money"
                      style={{
                        textDecoration: r.reversedBy !== null ? "line-through" : undefined,
                      }}
                    >
                      {fmtIQD(r.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="grand">
                  <td />
                  <td>
                    {reversed > 0
                      ? t("Total shown, less {n} reversed", { n: reversed })
                      : t("Total shown")}
                  </td>
                  <td />
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
            <h3>{t("By Account")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("The expenses above, by where they were posted")}
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
              <span className="lbl">{t("Total")}</span>
              <span className="amt">{fmtIQD(total)}</span>
            </div>
            <div className="rule-double" />
          </div>
        </section>
      )}
    </div>
  );
}
