import Link from "next/link";
import type { AccountRow } from "@/lib/accounts";
import { fmtIQD } from "@/lib/format";
import type { T } from "@/lib/i18n/core";
import { Icon } from "@/components/Icon";

/**
 * Who buys on account and what they owe (0077), the most owed first: how
 * much of it is overdue, and by how long. And what the books hold for it.
 */
export function AccountsList({
  rows,
  books,
  t,
}: {
  rows: AccountRow[];
  books: number | null;
  t: T;
}) {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.balance, 0);
  const overdue = rows.reduce((s, r) => s + r.overdue, 0);
  return (
    <section className="card grid" style={{ gap: 10 }} data-testid="accounts-list">
      <h2 style={{ margin: 0 }}>
        <Icon name="ledger" /> {t("On account")}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        {t("Owed to the café: {amount}, of which {overdue} is overdue.", {
          amount: fmtIQD(total),
          overdue: fmtIQD(overdue),
        })}
        {books !== null && books !== total && (
          <>
            {" "}
            <span className="red">{t("The books say {amount}.", { amount: fmtIQD(books) })}</span>
          </>
        )}
      </p>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("Customer")}</th>
              <th className="right">{t("They owe")}</th>
              <th className="right">{t("1–30 days late")}</th>
              <th className="right">{t("31–60 days late")}</th>
              <th className="right">{t("Over 60 days late")}</th>
              <th className="right">{t("Credit limit")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid="account-row">
                <td>
                  <Link href={`/customers/${r.id}#account`}>{r.name}</Link>
                </td>
                <td className="right mono">{fmtIQD(r.balance)}</td>
                <td className="right mono">{r.late30 > 0 ? fmtIQD(r.late30) : "—"}</td>
                <td className={`right mono${r.late60 > 0 ? " red" : ""}`}>
                  {r.late60 > 0 ? fmtIQD(r.late60) : "—"}
                </td>
                <td className={`right mono${r.lateMore > 0 ? " red" : ""}`}>
                  {r.lateMore > 0 ? fmtIQD(r.lateMore) : "—"}
                </td>
                <td className="right mono">{fmtIQD(r.creditLimit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
