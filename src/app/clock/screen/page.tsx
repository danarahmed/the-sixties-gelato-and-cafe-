import { ShopCode } from "@/components/clock/ShopCode";
import { getSession } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { signOutClockScreenAction } from "@/lib/actions/clock";

export const dynamic = "force-dynamic";

/**
 * The shop's code on the whole screen (0068): for a tablet by the door.
 * Signed in or not, the device's own key is what lets it see the code, so
 * whoever made it a clock screen is offered to sign out and leave it showing
 * the code: a screen anyone passing can touch is then nobody's way in.
 */
export default async function ClockScreenPage() {
  const [session, t] = await Promise.all([getSession().catch(() => null), getT()]);
  const name = session?.profile?.name ?? null;
  return (
    <div className="clock-screen-page">
      <ShopCode full />
      {name && (
        <form action={signOutClockScreenAction} className="clock-screen-signed-in">
          <span className="muted">
            {t("Signed in as {name}. A screen by the door is safer signed out: the code stays.", {
              name,
            })}
          </span>
          <button type="submit" data-testid="clock-screen-sign-out">
            {t("Sign out, keep the code")}
          </button>
        </form>
      )}
    </div>
  );
}
