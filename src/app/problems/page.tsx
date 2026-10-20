import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getProblems } from "@/lib/db/problems";
import { ProblemsList } from "./ProblemsList";

export const dynamic = "force-dynamic";

/**
 * What staff said went wrong (G5, 0083), newest first, those still open on
 * top: the screen, who, when and what the app knew. Each is marked dealt
 * with, with a note, or copied to send on to whoever looks after the system.
 */
export default async function ProblemsPage() {
  const profile = await requirePermission("audit.view", "settings.manage");
  const t = await getT();
  const list = await getProblems();
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div>
        <h1 style={{ margin: 0 }}>{t("Reported problems")}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {t(
            "What staff said went wrong, with the screen they were on. Mark each one dealt with once it is put right; copy one to send it on.",
          )}
        </p>
      </div>
      {list === null ? (
        <p className="muted">
          {t("Reported problems are kept once the owner applies the latest database update.")}
        </p>
      ) : (
        <ProblemsList list={list} timezone={profile.timezone} />
      )}
    </div>
  );
}
