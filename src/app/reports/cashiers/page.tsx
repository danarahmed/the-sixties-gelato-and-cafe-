import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/ui";
import { ReportVisit } from "@/components/reports/ReportVisit";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getCashierScorecard } from "@/lib/db/scorecard";
import { addDays, businessToday } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAYS = [7, 30, 90] as const;

/**
 * Comparing cashiers (0104): each person who took the money over the last
 * days, ranked fairly, by their sales an hour against what the café usually
 * sells in the same hours of the same weekdays. For the owner and the
 * managers; cashiers do not see it.
 */
export default async function CashiersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("profit.view");
  if (!has(profile, "staff.manage") && !profile.roles.includes("owner")) redirect("/reports");
  const [t, sp] = await Promise.all([getT(), searchParams]);
  const days = DAYS.find((d) => String(d) === sp.days) ?? 7;
  const today = businessToday(profile.timezone);
  const rows = await getCashierScorecard(addDays(today, -(days - 1)), today);
  if (!rows) redirect("/reports");
  const money = (v: number | null) => (v === null ? "—" : fmtIQD(v));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <ReportVisit path="/reports/cashiers" />
      <div className="phead">
        <h1>{t("Cashier scorecard")}</h1>
        <Link href="/reports" className="sc">
          {t("Back to Reports")}
        </Link>
      </div>
      <PageIntro
        text={t(
          "Each person who took the money, ranked fairly: their sales an hour worked against what the café usually sells in the same hours of the same weekdays (the eight weeks before). 100 is as usual. Cashiers do not see this page.",
        )}
        more={t("How this works")}
      />
      <div className="row" style={{ gap: 8 }}>
        {DAYS.map((d) => (
          <Link
            key={d}
            href={`/reports/cashiers?days=${d}`}
            className={d === days ? "chip active" : "chip"}
          >
            {t("Last {n} days", { n: d })}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t("No one took money in these days")} />
      ) : (
        <div className="card tw">
          <table data-testid="scorecard">
            <thead>
              <tr>
                <th>{t("Who")}</th>
                <th className="right">{t("Against usual")}</th>
                <th className="right">{t("Sales")}</th>
                <th className="right">{t("Bills")}</th>
                <th className="right">{t("Average bill")}</th>
                <th className="right">{t("Items a bill")}</th>
                <th className="right">{t("Add-ons a bill")}</th>
                <th className="right">{t("Hours")}</th>
                <th className="right">{t("Sales an hour")}</th>
                <th className="right">{t("Voids")}</th>
                <th className="right">{t("Refunds")}</th>
                <th className="right">{t("Discounts")}</th>
                <th className="right">{t("Drawer over or short")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.memberId} data-testid="scorecard-row">
                  <td>{r.name}</td>
                  <td
                    className={`right mono ${r.againstUsual === null ? "muted" : r.againstUsual >= 100 ? "green" : r.againstUsual < 80 ? "red" : ""}`}
                  >
                    {r.againstUsual === null ? "—" : r.againstUsual}
                  </td>
                  <td className="right mono">{fmtIQD(r.sales)}</td>
                  <td className="right mono">{r.bills}</td>
                  <td className="right mono">{money(r.averageBill)}</td>
                  <td className="right mono">{r.itemsPerBill ?? "—"}</td>
                  <td className="right mono">{r.addonsPerBill ?? "—"}</td>
                  <td className="right mono">{r.hours}</td>
                  <td className="right mono">{money(r.salesPerHour)}</td>
                  <td className="right mono">{r.voids}</td>
                  <td className="right mono">{r.refunds}</td>
                  <td className="right mono">
                    {r.discounts > 0 ? `${r.discounts} · ${fmtIQD(r.discounted)}` : "0"}
                  </td>
                  <td className={`right mono ${r.drawer < 0 ? "red" : ""}`}>{fmtIQD(r.drawer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
