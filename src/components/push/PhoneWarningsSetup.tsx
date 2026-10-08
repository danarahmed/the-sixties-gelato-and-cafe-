"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/ui";
import { useOperation } from "@/components/useOperation";
import { useT } from "@/lib/i18n/I18nProvider";
import { turnOffPhoneWarningsAction, turnOnPhoneWarningsAction } from "@/lib/actions/push";

type Msg = { ok: boolean; text: string } | null;

/**
 * Phone warnings for the café (0072, round eleven), on Settings: the owner
 * (or the general manager) turns them on once — the app makes the café's keys
 * for sending — or off. Then each person turns them on on a phone, on My
 * account. Says how many phones get them, and when the database cannot send.
 */
export function PhoneWarningsSetup({
  on,
  canSend,
  phones,
}: {
  on: boolean;
  canSend: boolean;
  phones: number | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  function turn(next: boolean) {
    setMsg(null);
    start(async () => {
      const r = next
        ? await op.run("phoneWarningsOn", (key) => turnOnPhoneWarningsAction(key))
        : await op.run("phoneWarningsOff", (key) => turnOffPhoneWarningsAction(key));
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({
        ok: true,
        text: next
          ? t("Phone warnings are on. Each person turns them on on a phone, on My account.")
          : t("Phone warnings are off: nothing more is sent."),
      });
      router.refresh();
    });
  }

  return (
    <div
      className="grid"
      style={{ gap: 10 }}
      data-testid="phone-warnings-setup"
      data-on={on ? "yes" : "no"}
    >
      {on ? (
        <>
          <p className="badge ok" style={{ margin: 0, justifySelf: "start" }}>
            {t("On, for {n} phone(s)", { n: phones ?? 0 })}
          </p>
          {!canSend && (
            <p
              className="badge warn"
              style={{ margin: 0, whiteSpace: "normal" }}
              data-testid="phone-warnings-cannot-send"
            >
              {t(
                "The database cannot send yet: it needs its timer and its calls out (the pg_cron and pg_net extensions, under Database → Extensions in Supabase). Nothing is sent until then.",
              )}
            </p>
          )}
          <button disabled={busy} onClick={() => turn(false)} style={{ justifySelf: "start" }}>
            {t("Turn phone warnings off for the café")}
          </button>
        </>
      ) : (
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() => turn(true)}
          style={{ justifySelf: "start" }}
          data-testid="phone-warnings-turn-on"
        >
          {t("Turn phone warnings on for the café")}
        </button>
      )}
      <Notice msg={msg} />
    </div>
  );
}
