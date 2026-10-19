"use client";

import { useActionState, useState } from "react";
import { verifyTwoStepAction } from "@/lib/auth/twoStep";
import { useT } from "@/lib/i18n/I18nProvider";

export function VerifyForm({ next }: { next: string }) {
  const { t, msg } = useT();
  const [state, action, pending] = useActionState(verifyTwoStepAction, { error: null });
  // Kept here, not in the form: a form is emptied after each try, and a code
  // typed while the last one was being checked would be lost.
  const [code, setCode] = useState("");
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
    </form>
  );
}
