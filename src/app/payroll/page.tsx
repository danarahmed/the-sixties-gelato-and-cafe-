import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getAdvances, getPayrollRuns, getStaff } from "@/lib/db/staff";
import { RUN_STATUS_LABEL, monthText } from "@/lib/staff";
import { fmtIQD } from "@/lib/format";
import { addDays, businessToday, dateTimeIn, monthStart } from "@/lib/dates";
import { Advances, DraftPayroll } from "@/components/payroll/PayrollHome";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = { draft: "badge warn", approved: "badge", paid: "badge ok" };

/**
 * Payroll (0049): each month's pay from the hours and the pay set on Staff,
 * drafted, adjusted and approved once the month is over, then paid; and the
 * advances given on pay, which the next payroll takes back.
 */
export default async function PayrollPage() {
  const profile = await requirePermission("payroll.view");
  const t = await getT();
  const canRun = has(profile, "payroll.run");
  const today = businessToday(profile.timezone);
  const [runs, { advances, owed }, people] = await Promise.all([
    getPayrollRuns(),
    getAdvances(),
    getStaff(),
  ]);
  const thisMonth = monthStart(today);
  const lastMonth = monthStart(addDays(thisMonth, -1));
  const months = [lastMonth, thisMonth].map((m) => ({ month: m, label: monthText(m) }));
  const working = people
    .filter((p) => p.leftOn === null || p.leftOn >= addDays(thisMonth, -31))
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.payroll")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        {t(
          "Each month's pay comes from the pay set on Staff and the hours worked. A draft is checked, adjusted with what is added or deducted and why, and approved once the month is over: the salaries are then owed, and paid from the bank, the safe, the till or by the owner.",
        )}
      </p>

      {canRun && (
        <section className="card grid" style={{ gap: 8 }}>
          <h2 style={{ margin: 0 }}>{t("Draft a payroll")}</h2>
          <DraftPayroll months={months} />
        </section>
      )}

      <section className="card grid" style={{ gap: 8 }}>
        <h2 style={{ margin: 0 }}>{t("The payrolls")}</h2>
        {runs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t("No payroll has been drafted yet.")}
          </p>
        ) : (
          <div className="tw">
            <table data-testid="payroll-runs">
              <thead>
                <tr>
                  <th>{t("No.")}</th>
                  <th>{t("Month")}</th>
                  <th>{t("Status")}</th>
                  <th className="right">{t("People")}</th>
                  <th className="right">{t("Gross")}</th>
                  <th className="right">{t("To be paid")}</th>
                  <th className="right">{t("Paid")}</th>
                  <th>{t("Approved")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} data-testid="payroll-run-row" data-month={monthText(r.month)}>
                    <td className="mono">
                      <Link href={`/payroll/${r.id}`}>{r.runNo}</Link>
                    </td>
                    <td>
                      <Link href={`/payroll/${r.id}`}>{monthText(r.month)}</Link>
                    </td>
                    <td>
                      <span className={BADGE[r.status] ?? "badge"}>
                        {t(RUN_STATUS_LABEL[r.status] ?? r.status)}
                      </span>
                    </td>
                    <td className="right">{r.people}</td>
                    <td className="right money">{fmtIQD(r.gross)}</td>
                    <td className="right money">{fmtIQD(r.net)}</td>
                    <td className="right money">{r.paid ? fmtIQD(r.paid) : "—"}</td>
                    <td style={{ fontSize: ".85rem" }}>
                      {r.approvedAt
                        ? t("{name}, {at}", {
                            name: r.approvedBy ?? "—",
                            at: dateTimeIn(profile.timezone, r.approvedAt),
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card grid" style={{ gap: 8 }} id="advances">
        <h2 style={{ margin: 0 }}>{t("Advances on pay")}</h2>
        <Advances advances={advances} owed={owed} people={working} canRun={canRun} />
      </section>

      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        <Link href="/staff">{t("Staff, the schedule and the hours →")}</Link>
      </p>
    </div>
  );
}
