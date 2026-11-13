import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/ui";
import { ReportVisit } from "@/components/reports/ReportVisit";
import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getSaleDayReport, getSaleDays, type SaleDayWindow } from "@/lib/db/saleDays";
import { fmtIQD } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * A sale day's result (0106): what was sold while it was on, against the same
 * days and hours of the weeks just before it; the discount it gave, and the
 * profit gained or lost.
 */
export default async function SaleDaysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("profit.view");
  const [t, sp] = await Promise.all([getT(), searchParams]);
  const saleDays = await getSaleDays();
  if (!saleDays) redirect("/reports");
  const begun = saleDays.filter((s) => s.status !== "planned");
  const chosen = (typeof sp.id === "string" && begun.find((s) => s.id === sp.id)) || begun[0];
  const report = chosen ? await getSaleDayReport(chosen.id) : null;
  const signed = (v: number) => (v > 0 ? `+${fmtIQD(v)}` : fmtIQD(v));
  const rows: [string, (w: SaleDayWindow) => string][] = [
    [t("Bills"), (w) => String(w.bills)],
    [t("At full price"), (w) => fmtIQD(w.fullPrice)],
    [t("Discount given"), (w) => fmtIQD(w.discount)],
    [t("Of it, the sale day's"), (w) => fmtIQD(w.saleDayDiscount)],
    [t("Sales"), (w) => fmtIQD(w.sales)],
    [t("What it cost"), (w) => fmtIQD(w.cost)],
    [t("Profit"), (w) => fmtIQD(w.profit)],
  ];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <ReportVisit path="/reports/sale-days" />
      <div className="phead">
        <h1>{t("Sale days")}</h1>
        <Link href="/reports" className="sc">
          {t("Back to Reports")}
        </Link>
      </div>
      <PageIntro
        text={t(
          "Each sale day's result: what was sold while it was on, against the same days and hours of the weeks just before it. The discount it gave, and the profit gained or lost.",
        )}
        more={t("How this works")}
      />
      {begun.length === 0 || !report ? (
        <EmptyState title={t("No sale day has begun yet")} />
      ) : (
        <>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {begun.map((s) => (
              <Link
                key={s.id}
                href={`/reports/sale-days?id=${s.id}`}
                className={s.id === chosen?.id ? "chip active" : "chip"}
              >
                {s.name} · {s.percent}%
              </Link>
            ))}
          </div>
          {!report.begun || !report.during || !report.before ? (
            <EmptyState title={t("No sale day has begun yet")} />
          ) : (
            <div className="card tw">
              <p style={{ marginTop: 0 }} data-testid="sale-day-verdict">
                <strong>
                  {report.profitChange >= 0
                    ? t("Profit {n} more than the weeks before", { n: fmtIQD(report.profitChange) })
                    : t("Profit {n} less than the weeks before", {
                        n: fmtIQD(-report.profitChange),
                      })}
                </strong>
                {" · "}
                {t("Sales {n}", { n: signed(report.salesChange) })}
                {" · "}
                {t("Bills {n}", {
                  n: report.billsChange > 0 ? `+${report.billsChange}` : String(report.billsChange),
                })}
              </p>
              <table data-testid="sale-day-result">
                <thead>
                  <tr>
                    <th />
                    <th className="right">{t("While it was on")}</th>
                    <th className="right">
                      {report.weeksBefore === 1
                        ? t("The week before")
                        : t("{n} weeks before", { n: report.weeksBefore })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, f]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td className="right mono">{f(report.during!)}</td>
                      <td className="right mono">{f(report.before!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
