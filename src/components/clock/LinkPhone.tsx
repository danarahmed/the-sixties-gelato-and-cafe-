"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { linkPhoneFinishAction } from "@/lib/actions/clock";
import { isKey } from "@/lib/clock";
import { useT } from "@/lib/i18n/I18nProvider";
import { Icon } from "@/components/Icon";

/**
 * A phone made someone's (0068), on the phone itself: the square a manager
 * showed on Staff opens this; one press links it, and the phone keeps a key of
 * its own from then on. A link works once and for ten minutes.
 */
export function LinkPhone({ linkKey, already }: { linkKey: string; already: string | null }) {
  const { t, msg: say } = useT();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    isKey(linkKey) ? null : "This link is not one of the café's: ask a manager for a new one",
  );
  const [busy, start] = useTransition();

  function link() {
    setError(null);
    start(async () => {
      const r = await linkPhoneFinishAction(linkKey);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (!r.data.ok) {
        setError(r.data.error);
        return;
      }
      setDone(r.data.name ?? "");
    });
  }

  return (
    <div className="phone-clock" data-testid="link-phone">
      <div className="phone-clock-head">
        <span className="phone-clock-mark" aria-hidden="true">
          <Icon name="phone" size={26} />
        </span>
        <div>
          <h1>{done !== null ? t("This phone is linked") : t("Link this phone")}</h1>
        </div>
      </div>
      {done !== null ? (
        <>
          <p className="phone-clock-done" role="status" data-testid="link-phone-done">
            <Icon name="check" size={28} />
            <span>{t("This phone clocks in {name} now.", { name: done })}</span>
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {t(
              "Each time you come in or leave, scan the code on the shop's clock screen with this phone's camera, and press Clock in or Clock out.",
            )}
          </p>
          <Link href="/clock" className="btn-primary phone-clock-go">
            <Icon name="clock" size={22} /> {t("Open the clock")}
          </Link>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            {t(
              "This phone will clock you in and out at the shop, without a PIN. Press the button on your own phone only.",
            )}
          </p>
          {already && (
            <p className="muted" style={{ margin: 0 }} data-testid="link-phone-already">
              {t("This phone clocks in {name} now: linking it makes it the new person's.", {
                name: already,
              })}
            </p>
          )}
          {isKey(linkKey) && (
            <button
              type="button"
              className="btn-primary phone-clock-go"
              disabled={busy}
              onClick={link}
              data-testid="link-phone-go"
            >
              <Icon name="phone" size={22} /> {busy ? "…" : t("Link this phone")}
            </button>
          )}
        </>
      )}
      {error && (
        <p className="red" style={{ margin: 0 }} role="alert" data-testid="link-phone-error">
          {say(error)}
        </p>
      )}
    </div>
  );
}
