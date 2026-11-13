import { notFound } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { BusinessPlans } from "@/components/admin/BusinessPlans";
import { getT } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth/session";
import { isSystemAdmin } from "@/lib/db/speed";
import { getAdminBusinesses } from "@/lib/db/parts";
import { getSupportProblems } from "@/lib/db/support";
import { dateTimeIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Every business on the system and its plan (0108), for the system's
 * administrators only: a plan changed here takes effect at once, nothing
 * installed and nothing lost. To anyone else the page does not exist.
 */
export default async function BusinessesPage() {
  const me = await requireMember();
  if (!(await isSystemAdmin())) notFound();
  const [t, businesses, problems] = await Promise.all([
    getT(),
    getAdminBusinesses(),
    getSupportProblems(),
  ]);
  if (!businesses) notFound();
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("Businesses and plans")}</h1>
      </div>
      <PageIntro
        text={t(
          "Every business on the system: how it is doing, its plan and its paying. A plan changed here takes effect at once: its parts appear or are hidden, and nothing is lost. Support looks only while a business's owner allows it.",
        )}
        more={t("How this works")}
      />
      <BusinessPlans businesses={businesses} timezone={me.timezone} />
      {problems && problems.length > 0 && (
        <div className="card tw">
          <h3 style={{ marginTop: 0 }}>{t("Problems sent to support")}</h3>
          <table data-testid="support-problems">
            <tbody>
              {problems.map((p) => (
                <tr key={p.id}>
                  <td>{dateTimeIn(me.timezone, p.at)}</td>
                  <td>{p.business}</td>
                  <td>{p.by}</td>
                  <td className="mono">{p.page}</td>
                  <td>
                    {p.what}
                    {p.error ? <div className="muted mono">{p.error}</div> : null}
                  </td>
                  <td>{p.status === "open" ? t("Open") : t("Dealt with")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
