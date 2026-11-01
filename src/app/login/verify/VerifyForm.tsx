"use client";

import { useActionState, useState } from "react";
import { backupCodeSignInAction, verifyTwoStepAction } from "@/lib/auth/twoStep";
import { useT } from "@/lib/i18n/I18nProvider";

export function VerifyForm({ next }: { next: string }) {
  const { t, msg } = useT();
  const [state, action, pending] = useActionState(verifyTwoStepAction, { error: null });
  const [backupState, backupAction, backupPending] = useActionState(backupCodeSignInAction, {
    error: null,
  });
  // Kept here, not in the form: a form is emptied after each try, and a code
  // typed while the last one was being checked would be lost.
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState("");
  // The phone lost (0095): one of the eight backup codes instead.
  const [lost, setLost] = useState(false);

  if (lost)
    return (
      <form action={backupAction} className="grid" style={{ gap: 10 }} data-testid="backup-form">
        <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
          {t(
            "Type one of the backup codes you kept when you turned the second step on. It takes the second step off, so you can turn it on again with your new phone.",
          )}
        </p>
        <input
          name="backup"
          value={backup}
          onChange={(e) => setBackup(e.target.value.toUpperCase().slice(0, 11))}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          dir="ltr"
          placeholder="ABCDE-FGH23" // i18n-ignore: a backup code's shape, the same in every language
          aria-label={t("Backup code")}
          data-testid="backup-code-input"
          style={{ minHeight: 52, fontSize: "1.3rem", letterSpacing: ".15em", textAlign: "center" }}
        />
        {backupState.error && (
          <p className="red" role="alert" style={{ margin: 0 }}>
            {msg(backupState.error)}
          </p>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={backupPending}
          data-testid="backup-submit"
        >
          {backupPending ? "…" : t("auth.signIn")}
        </button>
        <button type="button" className="linklike" onClick={() => setLost(false)}>
          {t("Use the six digits instead")}
        </button>
      </form>
    );

  return (
    <form action={action} className="grid" style={{ gap: 10 }}>
      <input type="hidden" name="next" value={next} />
      <input
        name="code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        aria-label={t("The six digits")}
        data-testid="verify-code"
        style={{ minHeight: 52, fontSize: "1.6rem", letterSpacing: ".3em", textAlign: "center" }}
      />
      {state.error && (
        <p className="red" role="alert" style={{ margin: 0 }}>
          {msg(state.error)}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending} data-testid="verify-submit">
        {pending ? "…" : t("auth.signIn")}
      </button>
      <button
        type="button"
        className="linklike"
        onClick={() => setLost(true)}
        data-testid="verify-lost-phone"
      >
        {t("Lost your phone? Use a backup code")}
      </button>
    </form>
  );
}
