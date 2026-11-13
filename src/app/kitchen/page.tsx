import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { KitchenScreen } from "@/components/kitchen/KitchenScreen";
import { getT } from "@/lib/i18n/server";
import { requirePart, requirePermission } from "@/lib/auth/session";
import { getKitchenSetup } from "@/lib/db/kitchen";

export const dynamic = "force-dynamic";

/**
 * The kitchen's screen (0110): each station's tickets as the till sends them,
 * the oldest first; ready, then done, with a tap. Asked again every few
 * seconds.
 */
export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("sale.create");
  requirePart(profile, "kitchen");
  const [t, sp, setup] = await Promise.all([getT(), searchParams, getKitchenSetup()]);
  if (!setup) redirect("/today");
  const stations = setup.stations.filter((s) => s.active);
  const chosen = typeof sp.station === "string" ? sp.station : "all";
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="phead">
        <h1>{t("Kitchen")}</h1>
      </div>
      <PageIntro
        text={t(
          "Each station's tickets, the oldest first, as the till sends them. Tap Ready when it is made, and Done when it has gone out.",
        )}
        more={t("How this works")}
      />
      <KitchenScreen stations={stations} chosen={chosen} />
    </div>
  );
}
