import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { Wholesale } from "@/components/wholesale/Wholesale";
import { getT } from "@/lib/i18n/server";
import { requirePart, requirePermission } from "@/lib/auth/session";
import {
  getDeliveryNotes,
  getQuotes,
  getRecentInvoices,
  getWholesaleChoices,
} from "@/lib/db/wholesale";
import { businessToday } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Selling wholesale (0111): quotes that become invoices at their own prices,
 * delivery notes out and signed for, credit notes, a customer's own prices,
 * and a stock item sold as it is or by the carton.
 */
export default async function WholesalePage() {
  const profile = await requirePermission("credit.manage");
  requirePart(profile, "quotes");
  const [t, quotes, notes, invoices, choices] = await Promise.all([
    getT(),
    getQuotes(),
    getDeliveryNotes(),
    getRecentInvoices(),
    getWholesaleChoices(),
  ]);
  if (!quotes || !notes) redirect("/customers");
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="phead">
        <h1>{t("Wholesale")}</h1>
      </div>
      <PageIntro
        text={t(
          "Quotes for customers on account, invoiced at the prices they gave; delivery notes out with the driver and signed for; credit notes for what came back; each customer's own prices; and a stock item sold as it is, or by the carton.",
        )}
        more={t("How this works")}
      />
      <Wholesale
        quotes={quotes}
        notes={notes}
        invoices={invoices}
        customers={choices.customers}
        sizes={choices.sizes}
        items={choices.items}
        today={businessToday(profile.timezone)}
      />
    </div>
  );
}
