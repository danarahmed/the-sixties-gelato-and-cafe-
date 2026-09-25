import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/supabase/config";
import { getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";

export const dynamic = "force-dynamic";

/** Shown instead of the app when the deployment has no database configured. */
export default async function SetupPage() {
  if (supabaseConfig()) redirect("/");
  const t = await getT();
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 style={{ marginTop: 0 }}>{t("Not configured")}</h1>
        <p>
          <Rich
            text={t(
              "This deployment has no database connection, so it shows nothing and records nothing. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> for the environment and deploy again.",
            )}
          />
        </p>
        <p className="muted" style={{ fontSize: ".85rem" }}>
          <Rich
            text={t(
              "There is intentionally no built-in default: a copy of the app must never write to another business's books by accident. See <code>docs/guides/deployment.md</code>.",
            )}
          />
        </p>
      </div>
    </div>
  );
}
