import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getBusinessRules } from "@/lib/db/rules";
import { getItems, getLocations } from "@/lib/db/read";
import { RulesManager } from "@/components/settings/RulesManager";
import { PageIntro } from "@/components/PageIntro";

export const dynamic = "force-dynamic";

/**
 * Settings → Rules (0040, release O): the café's rules, each with who set it,
 * when and why, and every change kept. The database applies them everywhere:
 * the till, refunds, losses, batches and corrections.
 */
export default async function RulesPage() {
  const profile = await requirePermission("settings.manage");
  const t = await getT();
  const [rules, items, locations] = await Promise.all([
    getBusinessRules(),
    getItems(),
    getLocations(),
  ]);
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("Rules")}</h1>
        <Link href="/settings" className="sc">
          {t("Back to Settings")}
        </Link>
      </div>
      <PageIntro
        text={t(
          "How the café works: the discount a cashier gives without a manager, the refunds and losses a second person approves, and what happens when more stock is used than the books hold. A rule set for a role, a kind of item or one item is used before the whole café's. Every change takes a reason, and is kept below and on the audit trail.",
        )}
        more={t("How this works")}
      />
      <RulesManager
        rules={rules}
        items={items.map((i) => ({ id: i.id, name: i.name }))}
        places={locations
          .filter((l) => l.isActive)
          .map((l) => ({ id: l.id, name: l.name, kind: l.kind }))}
        timezone={profile.timezone}
      />
    </div>
  );
}
