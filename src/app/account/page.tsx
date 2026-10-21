import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { roleLabel } from "@/lib/format";
import { signOutAction } from "@/lib/auth/actions";
import { PasswordForm } from "./PasswordForm";
import { PinForm } from "./PinForm";
import { getPhoneWarnings } from "@/lib/db/push";
import { PhoneWarnings } from "@/components/push/PhoneWarnings";
import { twoStepState } from "@/lib/auth/twoStep";
import { TwoStepCard } from "./TwoStepCard";
import { FirstScreenForm } from "./FirstScreenForm";
import { NAV, holdsAny, roleHome } from "@/lib/auth/routes";

export const dynamic = "force-dynamic";

/** Everyone's own page: who they are, what they may do, their password. */
export default async function AccountPage() {
  const t = await getT();
  const s = await getSession();
  if (!s.configured) redirect("/setup");
  if (!s.signedIn) redirect("/login");
  // Warnings on this phone (0072), for whoever sees the dashboard's; null before 0072.
  const warnings = s.profile ? await getPhoneWarnings() : null;
  // Two-step sign-in (0080): whether it is on for them.
  const twoStep = s.profile ? await twoStepState().catch(() => null) : null;

  // The screens they may start on (E6): those the menu offers them.
  const mine = s.profile ? NAV.filter((n) => holdsAny(s.profile!.permissions, n.anyOf)) : [];
  const roleScreen = s.profile ? roleHome(s.profile.permissions) : "/account";
  const roleScreenKey = NAV.find((n) => n.href === roleScreen)?.key ?? "nav.account";

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 720 }}>
      <h1 style={{ margin: 0 }}>{t("nav.account")}</h1>

      {!s.profile ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("account.notLinkedTitle")}</h3>
          <p>
            {t("account.notLinkedBody")} <strong dir="ltr">{s.email}</strong>
          </p>
          <p className="muted" style={{ fontSize: ".88rem" }}>
            {t("account.notLinkedHint")}
          </p>
        </div>
      ) : (
        <div className="card">
          <table>
            <tbody>
              <tr>
                <td className="muted">{t("account.name")}</td>
                <td>{s.profile.name}</td>
              </tr>
              <tr>
                <td className="muted">{t("auth.email")}</td>
                <td dir="ltr">{s.email}</td>
              </tr>
              <tr>
                <td className="muted">{t("account.business")}</td>
                <td>{s.profile.businessName}</td>
              </tr>
              <tr>
                <td className="muted">{t("account.roles")}</td>
                <td>{s.profile.roles.map((r) => t(roleLabel(r))).join(", ") || "—"}</td>
              </tr>
            </tbody>
          </table>
          <details style={{ marginBlockStart: 10 }}>
            <summary className="muted" style={{ cursor: "pointer", fontSize: ".85rem" }}>
              {t("account.permissions")} ({s.profile.permissions.length})
            </summary>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBlockStart: 8 }}>
              {s.profile.permissions.map((p) => (
                <span key={p} className="badge" translate="no" style={{ fontSize: ".72rem" }}>
                  {p}
                </span>
              ))}
            </div>
          </details>
        </div>
      )}

      {s.profile && mine.length > 1 && (
        <div className="card" data-testid="first-screen-card">
          <h3 style={{ marginTop: 0 }}>{t("First screen")}</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
            {t("Where you start after signing in, on any phone or till.")}
          </p>
          <FirstScreenForm
            screens={mine.map((n) => ({ href: n.href, label: t(n.key) }))}
            chosen={s.profile.firstScreen}
            roleScreen={t(roleScreenKey)}
          />
        </div>
      )}

      {s.profile && twoStep && (
        <TwoStepCard
          on={twoStep.on}
          factorId={twoStep.factorId}
          owner={s.profile.roles.includes("owner")}
        />
      )}

      {s.profile &&
        ["discount.approve", "sale.void", "sale.refund"].some((p) =>
          s.profile!.permissions.includes(p),
        ) && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t("account.pinTitle")}</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
              {t("account.pinHint")}
            </p>
            <PinForm hasPin={s.profile.hasPin} />
          </div>
        )}

      {warnings?.mayReceive && (
        <PhoneWarnings on={warnings.on} publicKey={warnings.publicKey} canSend={warnings.canSend} />
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("account.changePassword")}</h3>
        <PasswordForm />
      </div>

      <form action={signOutAction}>
        <button type="submit">{t("auth.signOut")}</button>
      </form>
    </div>
  );
}
