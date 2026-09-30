import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getBankBook } from "@/lib/db/bank";
import { businessToday } from "@/lib/dates";
import { BankReconciliation } from "@/components/books/BankReconciliation";

export const dynamic = "force-dynamic";

/**
 * The bank against its statement (0059): 1020 Bank reconciled with the bank's
 * own statement. Anyone who sees costs reads it; the owner, a general manager
 * or the accountant keeps a statement and undoes the latest.
 */
export default async function BankPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const book = await getBankBook(today);
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div>
        <div className="muted" style={{ fontSize: ".85rem" }}>
          <Link href="/accounting">{t("nav.chart")}</Link>
        </div>
        <div className="phead">
          <h1>{t("The bank against its statement")}</h1>
          <span className="sc">
            {t(
              "The bank's own statement shows whether the books have every payment in and out of the bank.",
            )}
          </span>
        </div>
      </div>
      <BankReconciliation book={book} canKeep={has(profile, "accounting.post")} today={today} />
    </div>
  );
}
