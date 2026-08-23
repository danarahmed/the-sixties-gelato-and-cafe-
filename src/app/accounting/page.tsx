import { getT } from "@/lib/i18n/server";
import { dayPnl, CHART_OF_ACCOUNTS, SAMPLE_JOURNAL } from "@/lib/demo/data";

export default async function AccountingPage() {
  const t = await getT();
  const pnl = dayPnl();
  const jDebit = SAMPLE_JOURNAL.lines.reduce((s, l) => s + l.debit, 0);
  const jCredit = SAMPLE_JOURNAL.lines.reduce((s, l) => s + l.credit, 0);
  const balanced = jDebit === jCredit;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.accounting")}</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Today — profit shown honestly (several numbers, not one)</h3>
        <table>
          <tbody>
            {pnl.map((l) => (
              <tr key={l.label}>
                <td
                  style={{ fontWeight: l.kind === "subtotal" ? 700 : 400 }}
                  className={l.kind === "cost" ? "muted" : ""}
                >
                  {l.label}
                </td>
                <td
                  className="right mono"
                  style={{
                    fontWeight: l.kind === "subtotal" ? 700 : 400,
                    color: l.kind === "subtotal" ? "var(--ok)" : undefined,
                  }}
                >
                  {l.kind === "cost" ? "−" : ""}
                  {l.amount.format()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: ".85rem" }}>
          Fixed overhead (rent, salaries, utilities) is not subtracted above — allocated item profit
          is a separate, clearly-labelled estimate that needs an allocation method.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Sample journal entry — {SAMPLE_JOURNAL.id}</h3>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
          {SAMPLE_JOURNAL.description}
        </p>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th className="right">Debit</th>
              <th className="right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_JOURNAL.lines.map((l, i) => (
              <tr key={i}>
                <td className="mono">{l.account}</td>
                <td className="right mono">{l.debit ? l.debit.toLocaleString() + " IQD" : ""}</td>
                <td className="right mono">{l.credit ? l.credit.toLocaleString() + " IQD" : ""}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Totals</strong>
              </td>
              <td className="right mono">
                <strong>{jDebit.toLocaleString()} IQD</strong>
              </td>
              <td className="right mono">
                <strong>{jCredit.toLocaleString()} IQD</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <span className={`badge ${balanced ? "ok" : "err"}`}>
          {balanced ? "✓ Balanced (debits = credits)" : "✗ Unbalanced"}
        </span>
        <p className="muted" style={{ fontSize: ".85rem" }}>
          The database rejects any unbalanced entry at commit, and blocks posting into a locked
          period. Corrections are reversing entries, never edits.
        </p>
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
            {CHART_OF_ACCOUNTS.map((a) => (
              <tr key={a.code}>
                <td className="mono">{a.code}</td>
                <td>{a.name}</td>
                <td className="muted">{a.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
