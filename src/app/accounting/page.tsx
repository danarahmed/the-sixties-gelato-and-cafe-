import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import {
  getAuditLog,
  getCloseChecklist,
  getPeriods,
  periodFor,
  type CheckRow,
} from "@/lib/db/books";
import { getTrialBalance } from "@/lib/db/reports";
import { fmtIQD } from "@/lib/format";
import { businessToday, dateTimeIn, monthEnd, monthStart } from "@/lib/dates";
import { PeriodControl } from "@/components/books/PeriodControl";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Income",
  expense: "Expense",
};

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const periods = await getPeriods();
  const chosen = periods.find((p) => p.id === sp.period) ?? periodFor(periods, today) ?? null;
  const from = chosen?.startsOn ?? monthStart(today);
  const to = chosen?.endsOn ?? monthEnd(today);

  const canSeeChecklist =
    has(profile, "accounting.period.lock") ||
    has(profile, "accounting.post") ||
    has(profile, "audit.view");
  const [trial, checklist, audit] = await Promise.all([
    getTrialBalance(from, to),
    chosen && canSeeChecklist ? getCloseChecklist(chosen.id) : Promise.resolve([] as CheckRow[]),
    has(profile, "audit.view") ? getAuditLog(40) : Promise.resolve([]),
  ]);

  const totalDebit = trial.reduce((s, r) => s + r.debit, 0);
  const totalCredit = trial.reduce((s, r) => s + r.credit, 0);
  const active = trial.filter(
    (r) => r.opening !== 0 || r.debit !== 0 || r.credit !== 0 || r.closing !== 0,
  );

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.chart")}</h1>
        <span className="sc">Trial balance &amp; closing the period</span>
        <div className="sp">
          <span className={`badge ${totalDebit === totalCredit ? "ok" : "err"}`}>
            Period debits {totalDebit === totalCredit ? "equal" : "do not equal"} credits
          </span>
          {chosen && (
            <span className={`badge ${chosen.status === "locked" ? "err" : ""}`}>
              {chosen.name} {chosen.status}
            </span>
          )}
        </div>
      </div>

      {periods.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {periods.slice(0, 18).map((p) => (
            <Link
              key={p.id}
              href={`/accounting?period=${p.id}`}
              className={`badge ${p.id === chosen?.id ? "ok" : ""}`}
            >
              {p.name}
              {p.status === "locked" ? " 🔒" : ""}
            </Link>
          ))}
        </div>
      )}

      <div className="masthead">
        <div className="entity">{profile.businessName}</div>
        <div className="doc">Trial Balance</div>
        <div className="period">
          {from} to {to} · published entries only · {profile.currency}
        </div>
        <div className="rule-band" />
      </div>

      <section className="panel">
        <div className="panel-h">
          <h3>Trial Balance</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            <a href={`/reports/export?report=trial_balance&from=${from}&to=${to}`}>Download CSV</a>
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>A/C</th>
                <th>Account</th>
                <th>Class</th>
                <th className="right">Opening</th>
                <th className="right">Debit</th>
                <th className="right">Credit</th>
                <th className="right">Closing</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted" style={{ fontStyle: "italic" }}>
                    Nothing posted up to the end of this period.
                  </td>
                </tr>
              ) : (
                active.map((r) => (
                  <tr key={r.code}>
                    <td className="faint">{r.code}</td>
                    <td>{r.name}</td>
                    <td>
                      <span className="ref">{TYPE_LABEL[r.type] ?? r.type}</span>
                    </td>
                    <td className="right money">{signed(r.opening)}</td>
                    <td className="right money">{r.debit ? fmtIQD(r.debit) : "—"}</td>
                    <td className="right money">{r.credit ? fmtIQD(r.credit) : "—"}</td>
                    <td className="right money">{signed(r.closing)}</td>
                  </tr>
                ))
              )}
              <tr className="grand">
                <td />
                <td>Totals for the period</td>
                <td />
                <td />
                <td className="right money">{fmtIQD(totalDebit)}</td>
                <td className="right money">{fmtIQD(totalCredit)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p
          className="muted"
          style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
        >
          Opening and closing balances are debit-positive (a credit balance shows in brackets).
          Drafts are excluded; so is anything outside the dates shown. That the debits equal the
          credits is guaranteed by the database for every published entry — whether the books are{" "}
          <em>right</em> is shown by the reconciliation on <Link href="/reports">Reports</Link>,
          which compares each subledger with its control account.
        </p>
      </section>

      {chosen && canSeeChecklist && (
        <PeriodControl
          period={{
            id: chosen.id,
            name: chosen.name,
            status: chosen.status,
            lockedAt: chosen.lockedAt,
            lockedBy: chosen.lockedBy,
          }}
          checklist={checklist}
          canLock={has(profile, "accounting.period.lock")}
          canUnlock={has(profile, "accounting.period.unlock")}
          timezone={profile.timezone}
        />
      )}

      {audit.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <h3>Audit Trail</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Written by the database in the same step as the action
            </span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>On</th>
                  <th>Reason</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="faint">{dateTimeIn(profile.timezone, a.at)}</td>
                    <td>{a.action}</td>
                    <td className="faint">{a.entity}</td>
                    <td>{a.reason ?? "—"}</td>
                    <td>{a.by ?? "—"}</td>
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

function signed(n: number): string {
  if (n === 0) return "—";
  return n < 0 ? `(${fmtIQD(-n)})` : fmtIQD(n);
}
