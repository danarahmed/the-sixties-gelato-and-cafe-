import { notFound } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { BusinessPlans } from "@/components/admin/BusinessPlans";
import { getT } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth/session";
import { isSystemAdmin } from "@/lib/db/speed";
import { getAdminBusinesses } from "@/lib/db/parts";

export const dynamic = "force-dynamic";

/**
 * Every business on the system and its plan (0108), for the system's
 * administrators only: a plan changed here takes effect at once, nothing
 * installed and nothing lost. To anyone else the page does not exist.
 */
export default async function BusinessesPage() {
  await requireMember();
  if (!(await isSystemAdmin())) notFound();
  const [t, businesses] = await Promise.all([getT(), getAdminBusinesses()]);
  if (!businesses) notFound();
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("Businesses and plans")}</h1>
      </div>
      <PageIntro
        text={t(
          "Every business on the system, its type and its plan. A plan changed here takes effect at once: its parts appear or are hidden, and nothing is lost.",
        )}
        more={t("How this works")}
      />
      <BusinessPlans businesses={businesses} />
    </div>
  );
}
