import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { twoStepState } from "@/lib/auth/twoStep";
import { signOutAction } from "@/lib/auth/actions";
import { VerifyForm } from "./VerifyForm";

export const dynamic = "force-dynamic";

/** The second step of signing in (0080): the six digits from the authenticator app. */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getT();
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const state = await twoStepState();
  if (!state.on || state.done)
    redirect(
      next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/",
    );
  return (
    <div className="auth-wrap">
      <div className="card grid" style={{ gap: 12, maxWidth: 380, margin: "10vh auto" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{t("One more step")}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t("Type the six digits your authenticator app shows for this café.")}
        </p>
        <VerifyForm next={next} />
        <form action={signOutAction}>
          <button type="submit" className="linklike">
            {t("auth.signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
