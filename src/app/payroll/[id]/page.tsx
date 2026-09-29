import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getPayroll } from "@/lib/db/staff";
import { PayrollRun } from "@/components/payroll/PayrollRun";

export const dynamic = "force-dynamic";

/** One month's payroll (0049): its lines, its approval and what has been paid from it. */
export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission("payroll.view");
  const t = await getT();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const run = await getPayroll(id);
  if (!run) notFound();

  return (
    <div className="grid" style={{ gap: 12 }}>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        <Link href="/payroll">{t("← All payrolls")}</Link>
      </p>
      <PayrollRun run={run} canRun={has(profile, "payroll.run")} timezone={profile.timezone} />
    </div>
  );
}
