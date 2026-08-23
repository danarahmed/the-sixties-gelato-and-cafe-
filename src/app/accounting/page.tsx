import { getT } from "@/lib/i18n/server";
import { getGlAccounts, getJournalEntries, getSalesOrders } from "@/lib/db/read";
import { fmtIQD } from "@/lib/format";
import { EmptyState } from "@/components/ui";

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
  const [accounts, journals, orders] = await Promise.all([
    getGlAccounts().catch(() => []),
    getJournalEntries(40).catch(() => []),
    getSalesOrders(500).catch(() => []),
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
          Fixed overhead (rent, salaries, utilities) is not subtracted here — it is entered separately.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Journal entries (auto-posted from sales)</h3>
        {journals.length === 0 ? (
          <EmptyState title="No journal entries yet" hint="Each POS sale posts a balanced double-entry: Dr cash/receivable · Cr revenue; Dr COGS · Cr inventory." />
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
