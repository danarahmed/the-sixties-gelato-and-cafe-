import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/ui";
import { ReportVisit } from "@/components/reports/ReportVisit";
import { getMsg, getT } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth/session";
import { NAV } from "@/lib/auth/routes";
import { getStuckReport } from "@/lib/db/stuck";
import { roleLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAYS = [7, 30, 90] as const;

/**
 * Where people get stuck (0097): for the owner, each screen's refusals and
 * help opened over the last days, by how many people and roles, and what was
 * said most. The screens at the top are the ones to make plainer.
 */
export default async function StuckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireMember();
  if (!profile.roles.includes("owner")) redirect("/reports");
  const [t, msg, sp] = await Promise.all([getT(), getMsg(), searchParams]);
  const days = DAYS.find((d) => String(d) === sp.days) ?? 30;
  const screens = await getStuckReport(days);
  if (!screens) redirect("/reports");
  // A screen by its name on the menu: the longest of the menu's addresses it starts with.
  const screenName = (path: string) => {
    const entry = [...NAV]
      .filter((n) => path === n.href || path.startsWith(`${n.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return entry ? `${t(entry.key)}${entry.href === path ? "" : ` (${path})`}` : path;
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <ReportVisit path="/reports/stuck" />
      <div className="phead">
        <h1>{t("Where people get stuck")}</h1>
        <Link href="/reports" className="sc">
          {t("Back to Reports")}
        </Link>
      </div>
      <PageIntro
        text={t(
          "Each time the database refuses something on a screen, or someone opens a screen's help, it is noted here. The screens at the top stop people most: make them plainer, or show people how, before adding more help. Practice is counted apart.",
        )}
        more={t("How this works")}
      />
      <div className="row" style={{ gap: 8 }}>
        {DAYS.map((d) => (
          <Link
            key={d}
            href={`/reports/stuck?days=${d}`}
            className={d === days ? "chip active" : "chip"}
          >
            {t("Last {n} days", { n: d })}
          </Link>
        ))}
      </div>
      {screens.length === 0 ? (
        <EmptyState
          title={t("No one was stuck")}
          hint={t("Nothing was refused and no help was opened in these days.")}
        />
      ) : (
        <div className="card tw">
          <table data-testid="stuck-table">
            <thead>
              <tr>
                <th>{t("Screen")}</th>
                <th className="right">{t("Refused")}</th>
                <th className="right">{t("Help opened")}</th>
                <th className="right">{t("In practice")}</th>
                <th>{t("Who")}</th>
                <th>{t("Said most")}</th>
              </tr>
            </thead>
            <tbody>
              {screens.map((s) => (
                <tr key={s.path} data-testid="stuck-row" data-path={s.path}>
                  <td>{screenName(s.path)}</td>
                  <td className="right mono">{s.refused}</td>
                  <td className="right mono">{s.help}</td>
                  <td className="right mono muted">{s.practice}</td>
                  <td className="muted">
                    {t("{n} people", { n: s.people })}
                    {s.roles.length > 0 && ` · ${s.roles.map((r) => t(roleLabel(r))).join(", ")}`}
                  </td>
                  <td style={{ fontSize: ".85rem" }}>
                    {s.messages.map((m) => (
                      <div key={m.message}>
                        {msg(m.message)} <span className="muted">×{m.times}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: ".85rem", margin: 0 }}>
        {t(
          "Before the app goes to a new café, watch two or three people who have never seen it do five tasks with no help, and fix what stops them: the steps are in the owner's guide.",
        )}
      </p>
    </div>
  );
}
