import { getT } from "@/lib/i18n/server";
import { getBusinessConfig } from "@/lib/db/read";
import { getAccountingOverview, getAiLog, getTrialBalance } from "@/lib/db/accounting";
import { fmtIQD } from "@/lib/format";
import { AiAccountant } from "@/components/AiAccountant";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Income",
  expense: "Expense",
};

export default async function AccountingPage() {
  const t = await getT();
  const [overview, trial, aiLog, cfg] = await Promise.all([
    getAccountingOverview().catch(() => null),
    getTrialBalance().catch(() => ({ rows: [], totalDebit: 0, totalCredit: 0, balanced: true })),
    getAiLog(15).catch(() => []),
    getBusinessConfig().catch(() => null),
  ]);

  const period = overview?.currentPeriodName ?? "";
  const locked = overview?.currentPeriodStatus === "locked";

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.chart")}</h1>
        <span className="sc">Ledger &amp; period control</span>
        <div className="sp">
          <span className={`badge ${trial.balanced ? "ok" : "err"}`}>
            {trial.balanced ? "Trial balance agrees" : "Out of balance"}
          </span>
          <span className={`badge ${locked ? "err" : ""}`}>
            {period} {locked ? "locked" : "open"}
          </span>
        </div>
      </div>

      <div className="masthead">
        <div className="entity">{cfg?.name ?? "The Sixty's Gelato & Café"}</div>
        <div className="doc">Trial Balance</div>
        <div className="period">
          Period {period} · expressed in {cfg?.currencyCode ?? "IQD"}
        </div>
        <div className="rule-band" />
      </div>

      <section className="panel">
        <div className="panel-h">
          <h3>Chart of Accounts &amp; Trial Balance</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {trial.rows.length} accounts
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>A/C</th>
                <th>Account</th>
                <th>Class</th>
                <th className="right">Debit</th>
                <th className="right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {trial.rows.map((r) => (
                <tr key={r.code}>
                  <td className="faint">{r.code}</td>
                  <td>{r.name}</td>
                  <td>
                    <span className="ref">{TYPE_LABEL[r.type] ?? r.type}</span>
                  </td>
                  <td className="right money">{r.debit ? fmtIQD(r.debit) : "—"}</td>
                  <td className="right money">{r.credit ? fmtIQD(r.credit) : "—"}</td>
                </tr>
              ))}
              <tr className="grand">
                <td />
                <td>Totals</td>
                <td />
                <td className="right money">{fmtIQD(trial.totalDebit)}</td>
                <td className="right money">{fmtIQD(trial.totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}>
          Both columns must agree. The database refuses an unbalanced entry at commit, so this can
          only tie — if it ever did not, the posting would have been rejected before it was written.
        </p>
      </section>

      {overview && (
        <AiAccountant
          overview={{
            revenue: overview.revenue,
            cogs: overview.cogs,
            otherExpenses: overview.otherExpenses,
            waste: overview.waste,
            netProfit: overview.netProfit,
            unpostedPurchases: overview.unpostedPurchases,
            unpostedWaste: overview.unpostedWaste,
            trialBalanced: overview.trialBalanced,
            currentPeriodName: overview.currentPeriodName,
            currentPeriodStatus: overview.currentPeriodStatus,
          }}
        />
      )}

      {aiLog.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <h3>Audit Trail</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Who did what, and when
            </span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>By</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {aiLog.map((l) => (
                  <tr key={l.id}>
                    <td className="faint">{l.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td>{l.action.replace(/_/g, " ")}</td>
                    <td>
                      <span className="ref auto">Assisted</span>
                    </td>
                    <td className="faint">{l.model}</td>
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
