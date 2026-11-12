import { notFound } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { SpeedCheck } from "@/components/admin/SpeedCheck";
import { getT } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth/session";
import { getSpeedSamples, isSystemAdmin } from "@/lib/db/speed";

export const dynamic = "force-dynamic";

/**
 * Speed (plan 8, 0100): for the system's administrators only, never a café's
 * owner. The trip from this device to the app, from the app to the database,
 * and the time each slow screen's call takes, measured now; kept, so it can
 * be sent. To anyone else the page does not exist.
 */
export default async function SpeedPage() {
  await requireMember();
  if (!(await isSystemAdmin())) notFound();
  const [t, samples] = await Promise.all([getT(), getSpeedSamples()]);
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("Speed")}</h1>
      </div>
      <PageIntro
        text={t(
          "How long this device takes to reach the app, the app the database, and each slow screen's call, measured now, from here. Measure from the café, at a busy time and a quiet one, and keep what you measure: it says whether a faster plan or a closer region would help.",
        )}
        more={t("How this works")}
      />
      <SpeedCheck samples={samples} />
    </div>
  );
}
