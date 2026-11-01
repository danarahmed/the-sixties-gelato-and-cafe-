"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmTwoStepAction,
  makeBackupCodesAction,
  startTwoStepAction,
  stopTwoStepAction,
} from "@/lib/auth/twoStep";
import { useT } from "@/lib/i18n/I18nProvider";
import { Icon } from "@/components/Icon";

/**
 * Two-step sign-in (0080): turned on with an authenticator app on the phone
 * (Google Authenticator, Microsoft Authenticator…): scan the code, type the
 * six digits it shows. From then on, signing in asks for those digits after
 * the password, and a password alone opens nothing.
 *
 * Eight backup codes (0095) are shown once when it is turned on: one of them,
 * typed instead of the digits when the phone is lost, takes the second step
 * off so the person can sign in and turn it on again with a new phone.
 */
export function TwoStepCard({
  on,
  factorId,
  owner,
  codesLeft = null,
  reset = false,
}: {
  on: boolean;
  factorId: string | null;
  owner: boolean;
  /** Backup codes left; null before 0095. */
  codesLeft?: number | null;
  /** Just signed in with a backup code: the second step is off. */
  reset?: boolean;
}) {
  const { t, msg } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  // The backup codes, while they are on the screen: shown once, never again.
  const [codes, setCodes] = useState<string[] | null>(null);

  function makeCodes() {
    setError(null);
    start(async () => {
      const r = await makeBackupCodesAction();
      if (!r.ok) return setError(r.error);
      setCodes(r.data);
    });
  }

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
      // Its backup codes, made at once and shown once; none before 0095.
      const c = await makeBackupCodesAction();
      if (c.ok && c.data.length > 0) setCodes(c.data);
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
      {reset && (
        <p
          className="badge warn"
          role="status"
          style={{ whiteSpace: "normal", margin: 0 }}
          data-testid="two-step-reset"
        >
          {t(
            "You signed in with a backup code: the second step is off, and your other codes are used up. Turn it on again with your new phone.",
          )}
        </p>
      )}
      {codes ? (
        <div className="grid" style={{ gap: 8 }} data-testid="backup-codes">
          <strong>{t("Your backup codes")}</strong>
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            {t(
              "Write them down or print them, and keep them away from your phone. If the phone is lost, one of them, typed instead of the six digits, lets you in. Each works once. They are not shown again.",
            )}
          </p>
          <ol
            className="backup-codes"
            dir="ltr"
            style={{
              margin: 0,
              columns: 2,
              fontFamily: "var(--mono, monospace)",
              fontSize: "1.05rem",
            }}
          >
            {codes.map((c) => (
              <li key={c} data-testid="backup-code">
                {c}
              </li>
            ))}
          </ol>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" onClick={() => window.print()}>
              {t("Print")}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCodes(null)}
              data-testid="backup-codes-kept"
            >
              {t("I have kept them")}
            </button>
          </div>
        </div>
      ) : on ? (
        <>
          <p className="pos-val" style={{ margin: 0 }} data-testid="two-step-on">
            <Icon name="check" />{" "}
            {t("On: signing in asks for the code from your authenticator app.")}
          </p>
          {codesLeft !== null && (
            <p
              className="muted"
              style={{ margin: 0, fontSize: ".85rem" }}
              data-testid="backup-codes-left"
            >
              {codesLeft === 0
                ? t("No backup codes left: make new ones, in case the phone is lost.")
                : t("{n} backup codes left, for when the phone is lost.", { n: codesLeft })}
            </p>
          )}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {codesLeft !== null && (
              <button
                type="button"
                disabled={busy}
                onClick={makeCodes}
                data-testid="backup-codes-new"
              >
                {t("Make new backup codes")}
              </button>
            )}
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
