import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { getT } from "@/lib/i18n/server";
import { has, requireMember } from "@/lib/auth/session";
import { getPayslip } from "@/lib/db/socialInsurance";
import { RATE_PER, RUN_STATUS_LABEL, type PayBasis } from "@/lib/staff";
import { fmtIQD } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * A payslip (0112): one person's month, line by line, from what they earned
 * to what they are paid, with the social insurance taken and the café's part.
 * Read by payroll.view, or by the person themselves; printed and handed over.
 */
export default async function PayslipPage({ params }: { params: Promise<{ line: string }> }) {
  const profile = await requireMember();
  const t = await getT();
  const { line } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(line)) notFound();
  const s = await getPayslip(line);
  if (!s) notFound();

  const rows: [string, number, string | null][] = [
    [t("Base"), s.basePay, null],
    [t("Overtime"), s.overtimePay, null],
    [t("Tips"), s.tips, null],
    [t("Added"), s.additions, s.additionsNote],
    [t("Deducted"), -s.deductions, s.deductionsNote],
  ];
  const less: [string, number][] = [
    [t("Advance taken back"), s.advanceRecovered],
    [t("Social insurance, the person's part"), s.siEmployee],
  ];

  return (
    <div className="grid" style={{ gap: 12, maxWidth: 640 }}>
      <p
        className="muted no-print"
        style={{ margin: 0, fontSize: ".85rem", display: "flex", gap: 12 }}
      >
        {has(profile, "payroll.view") && <Link href="/payroll">{t("← All payrolls")}</Link>}
        <PrintButton />
      </p>
      <section className="card grid" style={{ gap: 8 }} data-testid="payslip">
        <div>
          <div className="muted" style={{ fontSize: ".85rem" }}>
            {s.business}
          </div>
          <h1 style={{ margin: 0 }}>{t("Payslip")}</h1>
          <div>
            <b dir="auto">{s.name}</b>
            {s.title && <span className="muted"> · {s.title}</span>}
          </div>
          <div className="muted" style={{ fontSize: ".85rem" }}>
            {s.monthText} · {t("No.")} {s.runNo} · {t(RUN_STATUS_LABEL[s.status] ?? s.status)}
          </div>
        </div>
        <div className="muted" style={{ fontSize: ".85rem" }}>
          {s.payBasis && s.rate !== null && RATE_PER[s.payBasis as PayBasis]
            ? t(RATE_PER[s.payBasis as PayBasis], { amount: fmtIQD(s.rate) })
            : null}
          {" · "}
          {t("{days} days, {hours}", { days: String(s.daysWorked), hours: `${s.hours} h` })}
          {s.overtimeHours > 0 && ` · ${t("Overtime {time}", { time: `${s.overtimeHours} h` })}`}
        </div>
        <table>
          <tbody>
            {rows
              .filter(([, v]) => v !== 0)
              .map(([label, v, note]) => (
                <tr key={label}>
                  <td>
                    {label}
                    {note && (
                      <div className="muted" style={{ fontSize: ".75rem" }}>
                        {note}
                      </div>
                    )}
                  </td>
                  <td className="right money">{fmtIQD(v)}</td>
                </tr>
              ))}
            <tr style={{ fontWeight: 600 }}>
              <td>{t("Gross")}</td>
              <td className="right money">{fmtIQD(s.gross)}</td>
            </tr>
            {less
              .filter(([, v]) => v !== 0)
              .map(([label, v]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="right money">−{fmtIQD(v)}</td>
                </tr>
              ))}
            <tr style={{ fontWeight: 700 }}>
              <td>{t("To be paid")}</td>
              <td className="right money" data-testid="payslip-net">
                {fmtIQD(s.net)}
              </td>
            </tr>
          </tbody>
        </table>
        {s.siEmployer > 0 && (
          <p
            className="muted"
            style={{ margin: 0, fontSize: ".8rem" }}
            data-testid="payslip-employer"
          >
            {t("The café pays {amount} social insurance for them too, on top of the pay.", {
              amount: fmtIQD(s.siEmployer),
            })}
          </p>
        )}
      </section>
    </div>
  );
}
