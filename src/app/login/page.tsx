import { getT } from "@/lib/i18n/server";
import { Icon } from "@/components/Icon";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

/**
 * The café's front door: its name on its own raspberry, with a cone of three
 * of its flavours drawn beside it and what the system is for, then the form.
 * On a phone the name is a band above the form, and the form comes first.
 */
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
      <div className="auth-split">
        <section className="auth-hero">
          {/* Three scoops and a cherry on a cone: drawn, not said. */}
          <div className="auth-scoops" aria-hidden="true">
            <span className="auth-cone" />
            <span className="scoop s1" />
            <span className="scoop s2" />
            <span className="scoop s3" />
            <span className="scoop cherry" />
          </div>
          <span className="auth-mark" aria-hidden="true">
            <Icon name="cone" size={30} />
          </span>
          <h1>{t("app.name")}</h1>
          <p className="auth-tag">{t("The till, the kitchen and the books, in one place.")}</p>
          <ul className="auth-points">
            <li>
              <Icon name="cone" size={18} />
              {t("Sell at the counter, at a table, or for delivery")}
            </li>
            <li>
              <Icon name="bowl" size={18} />
              {t("Make, count and keep the stock right")}
            </li>
            <li>
              <Icon name="reports" size={18} />
              {t("See the day's figures, and what they mean")}
            </li>
          </ul>
        </section>
        <div className="auth-card">
          <h2>{t("Welcome back")}</h2>
          <p className="muted">{t("auth.intro")}</p>
          {linkFailed && (
            <div className="badge err" style={{ whiteSpace: "normal", marginBlockEnd: 12 }}>
              {t("auth.linkFailed")}
            </div>
          )}
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
