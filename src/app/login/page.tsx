import { getT } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getT();
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const linkFailed = sp.error === "link";

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 style={{ margin: "0 0 4px" }}>{t("app.name")}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {t("auth.intro")}
        </p>
        {linkFailed && (
          <div className="badge err" style={{ whiteSpace: "normal", marginBlockEnd: 12 }}>
            {t("auth.linkFailed")}
          </div>
        )}
        <LoginForm next={next} />
      </div>
    </div>
  );
}
