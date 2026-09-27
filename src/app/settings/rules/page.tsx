import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getBusinessRules } from "@/lib/db/rules";
import { getItems } from "@/lib/db/read";
import { RulesManager } from "@/components/settings/RulesManager";

export const dynamic = "force-dynamic";

/**
 * Settings → Rules (0040, release O): the café's rules, each with who set it,
 * when and why, and every change kept. The database applies them everywhere:
 * the till, refunds, losses, batches and corrections.
 */
export default async function RulesPage() {
  const profile = await requirePermission("settings.manage");
  const t = await getT();
  const [rules, items] = await Promise.all([getBusinessRules(), getItems()]);
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("Rules")}</h1>
        <Link href="/settings" className="sc">
          {t("Back to Settings")}
        </Link>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        {t(
          "How the café works: the discount a cashier gives without a manager, the refunds and losses a second person approves, and what happens when more stock is used than the books hold. A rule set for a role, a kind of item or one item is used before the whole café's. Every change takes a reason, and is kept below and on the audit trail.",
        )}
      </p>
      <RulesManager
        rules={rules}
        items={items.map((i) => ({ id: i.id, name: i.name }))}
        timezone={profile.timezone}
      />
    </div>
  );
}
