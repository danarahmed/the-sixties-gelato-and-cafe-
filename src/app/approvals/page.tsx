import { requirePermission } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getApprovals } from "@/lib/db/approvals";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/ui";
import { ApprovalsInbox } from "@/components/ApprovalsInbox";

export const dynamic = "force-dynamic";

/**
 * Everything waiting for a manager, in one place (0088, E5): stock counts,
 * losses saved to wait, purchase orders drafted, the month's pay. Each is
 * decided here, by the same database function its own screen uses.
 */
export default async function ApprovalsPage() {
  const profile = await requirePermission(
    "inventory.adjust.approve",
    "waste.approve",
    "purchase.approve",
    "payroll.run",
  );
  const t = await getT();
  const items = await getApprovals();
  return (
    <div className="grid" style={{ gap: 16, maxWidth: 900 }}>
      <h1>{t("nav.approvals")}</h1>
      <PageIntro
        text={t(
          "What waits for a manager, oldest first. Stock counts, losses saved to wait, purchase orders and the month's pay: each with who asked, when, why and how much, approved or sent back here. Nobody approves what they asked for themselves.",
        )}
        more={t("How this works")}
      />
      {items === null ? (
        <EmptyState
          title={t("The database needs an update for this screen")}
          hint={t("Apply migration 0088 in the SQL editor.")}
        />
      ) : items.length === 0 ? (
        <EmptyState title={t("Nothing waits for you.")} />
      ) : (
        <ApprovalsInbox items={items} timezone={profile.timezone} />
      )}
    </div>
  );
}
