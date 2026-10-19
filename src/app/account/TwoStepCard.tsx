"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmTwoStepAction, startTwoStepAction, stopTwoStepAction } from "@/lib/auth/twoStep";
import { useT } from "@/lib/i18n/I18nProvider";
import { Icon } from "@/components/Icon";

/**
 * Two-step sign-in (0080): turned on with an authenticator app on the phone
 * (Google Authenticator, Microsoft Authenticator…): scan the code, type the
 * six digits it shows. From then on, signing in asks for those digits after
 * the password, and a password alone opens nothing.
 */
export function TwoStepCard({
  on,
  factorId,
  owner,
}: {
  on: boolean;
  factorId: string | null;
  owner: boolean;
}) {
  const { t, msg } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  function begin() {
    setError(null);
    start(async () => {
      const r = await startTwoStepAction();
      if (!r.ok) return setError(r.error);
      setSetup(r.data);
      setCode("");
    });
  }
  function confirm() {
    if (!setup) return;
    setError(null);
    start(async () => {
      const r = await confirmTwoStepAction(setup.factorId, code);
      if (!r.ok) return setError(r.error);
      setSetup(null);
      router.refresh();
    });
  }
  function stop() {
    if (!factorId) return;
    setError(null);
    start(async () => {
      const r = await stopTwoStepAction(factorId);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="card grid" style={{ gap: 10 }} data-testid="two-step">
      <h3 style={{ margin: 0 }}>
        <Icon name="shield" /> {t("Two-step sign-in")}
      </h3>
      {on ? (
        <>
          <p className="pos-val" style={{ margin: 0 }} data-testid="two-step-on">
            <Icon name="check" />{" "}
            {t("On: signing in asks for the code from your authenticator app.")}
          </p>
          <div>
            <button type="button" disabled={busy} onClick={stop} data-testid="two-step-off">
              {t("Turn it off")}
            </button>
          </div>
        </>
      ) : setup ? (
        <>
          <ol style={{ margin: 0, paddingInlineStart: 18 }}>
            <li>{t("Open an authenticator app on your phone and scan this code:")}</li>
          </ol>
          <img
            src={setup.qr}
            alt={t("The code to scan")}
            width={180}
            height={180}
            className="two-step-qr"
          />
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            {t("Or type this key into the app:")}{" "}
            <code dir="ltr" data-testid="two-step-secret">
              {setup.secret}
            </code>
          </p>
          <label style={{ display: "grid", gap: 4, maxWidth: 220 }}>
            <span className="muted">{t("Then type the six digits it shows")}</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              data-testid="two-step-code"
              style={{ minHeight: 44, fontSize: "1.2rem", letterSpacing: ".2em" }}
            />
          </label>
          <div>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || code.length !== 6}
              onClick={confirm}
              data-testid="two-step-confirm"
            >
              {t("Turn it on")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>
            {owner
              ? t(
                  "Recommended for the owner: with it, someone who learns your password still cannot open the books without your phone.",
                )
              : t(
                  "With it, someone who learns your password still cannot sign in without your phone.",
                )}
          </p>
          <div>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={begin}
              data-testid="two-step-start"
            >
              {t("Turn on two-step sign-in")}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="red" role="alert" style={{ margin: 0 }}>
          {msg(error)}
        </p>
      )}
    </div>
  );
}
