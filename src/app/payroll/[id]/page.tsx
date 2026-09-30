import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getPayroll } from "@/lib/db/staff";
import { getCashOnHand } from "@/lib/db/books";
import { PayrollRun } from "@/components/payroll/PayrollRun";

export const dynamic = "force-dynamic";

/** One month's payroll (0049): its lines, its approval and what has been paid from it. */
export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission("payroll.view");
  const t = await getT();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const canRun = has(profile, "payroll.run");
  // What the safe and the drawer hold (AK), to those who may read them: a
  // salary paid from the till comes out of the first branch's drawer (0049).
  const seesCash = canRun && (has(profile, "cost.view") || has(profile, "day.close"));
  const [run, cash] = await Promise.all([
    getPayroll(id),
    seesCash ? getCashOnHand(null) : Promise.resolve(null),
  ]);
  if (!run) notFound();

  return (
    <div className="grid" style={{ gap: 12 }}>
      <PrintHead
        business={profile.businessName}
        title={t("nav.payroll")}
        period={run.month}
        timezone={profile.timezone}
      />
      <p className="muted" style={{ margin: 0, fontSize: ".85rem", display: "flex", gap: 12 }}>
        <Link href="/payroll">{t("← All payrolls")}</Link>
        <PrintButton />
      </p>
      <PayrollRun run={run} canRun={canRun} timezone={profile.timezone} cash={cash} />
    </div>
  );
}
