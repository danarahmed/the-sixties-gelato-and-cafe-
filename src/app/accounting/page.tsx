import { getT } from "@/lib/i18n/server";
import { getGlAccounts, getJournalEntries, getSalesOrders } from "@/lib/db/read";
import { getAccountingOverview, getAiLog } from "@/lib/db/accounting";
import { fmtIQD } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { AiAccountant } from "@/components/AiAccountant";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

export default async function AccountingPage() {
  const t = await getT();
  const [accounts, journals, orders, overview, aiLog] = await Promise.all([
    getGlAccounts().catch(() => []),
    getJournalEntries(40).catch(() => []),
    getSalesOrders(500).catch(() => []),
    getAccountingOverview().catch(() => null),
    getAiLog(15).catch(() => []),
  ]);

  const grossSales = orders.reduce((s, o) => s + o.net, 0);
  const cogs = orders.reduce((s, o) => s + o.cogs, 0);
  const grossProfit = grossSales - cogs;
  const pnl = [
    { label: "Gross sales", amount: grossSales, kind: "revenue" as const },
    { label: "Cost of goods sold", amount: cogs, kind: "cost" as const },
    { label: "Gross profit", amount: grossProfit, kind: "subtotal" as const },
  ];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="badge ok" style={{ alignSelf: "start" }}>🟢 Live database</div>
      <h1 style={{ margin: 0 }}>{t("nav.accounting")}</h1>

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

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Profit from recorded sales</h3>
        {orders.length === 0 ? (
          <p className="muted" style={{ fontSize: ".9rem" }}>No sales recorded yet — record a sale on POS.</p>
        ) : (
          <table>
            <tbody>
              {pnl.map((l) => (
                <tr key={l.label}>
                  <td style={{ fontWeight: l.kind === "subtotal" ? 700 : 400 }} className={l.kind === "cost" ? "muted" : ""}>
                    {l.label}
                  </td>
                  <td className="right mono" style={{ fontWeight: l.kind === "subtotal" ? 700 : 400, color: l.kind === "subtotal" ? "var(--ok)" : undefined }}>
                    {l.kind === "cost" ? "−" : ""}
                    {fmtIQD(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ fontSize: ".85rem" }}>
          Fixed overhead (rent, salaries, utilities) is entered via the AI Accountant above and shows
          in the full month-end close.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Journal entries</h3>
        {journals.length === 0 ? (
          <EmptyState title="No journal entries yet" hint="POS sales, plus the AI Accountant’s auto-posting and expenses, write balanced double-entries here." />
        ) : (
          journals.map((j) => {
            const d = j.lines.reduce((s, l) => s + l.debit, 0);
            const c = j.lines.reduce((s, l) => s + l.credit, 0);
            return (
              <details key={j.id} className="card" style={{ marginBottom: 8 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  {j.description} · {j.occurredAt.slice(0, 16).replace("T", " ")}{" "}
                  <span className={`badge ${d === c ? "ok" : "err"}`}>{d === c ? "balanced" : "unbalanced"}</span>
                </summary>
                <table style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th className="right">Debit</th>
                      <th className="right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="mono">{l.account}</td>
                        <td className="right mono">{l.debit ? fmtIQD(l.debit) : ""}</td>
                        <td className="right mono">{l.credit ? fmtIQD(l.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            );
          })
        )}
      </div>

      {aiLog.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>AI audit trail</h3>
          <p className="muted" style={{ fontSize: ".82rem", marginTop: 0 }}>
            Every AI action is logged (provider, model, action) — so the books stay auditable when the
            real model is wired.
          </p>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Provider</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {aiLog.map((l) => (
                <tr key={l.id}>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>
                    {l.createdAt.slice(0, 16).replace("T", " ")}
                  </td>
                  <td>{l.action.replace(/_/g, " ")}</td>
                  <td><span className="badge">{l.provider}</span></td>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>{l.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Chart of accounts</h3>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.code}</td>
                <td>{a.name}</td>
                <td className="muted">{TYPE_LABEL[a.type] ?? a.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
