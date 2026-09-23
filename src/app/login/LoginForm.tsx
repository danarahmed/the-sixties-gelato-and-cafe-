"use client";

import { useActionState, useState } from "react";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  type AuthFormState,
} from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";

type Mode = "signin" | "signup" | "reset";
const initial: AuthFormState = { ok: false, message: null };

export function LoginForm({ next }: { next: string }) {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signIn, signingIn] = useActionState(signInAction, initial);
  const [signUpState, signUp, signingUp] = useActionState(signUpAction, initial);
  const [resetState, reset, resetting] = useActionState(requestPasswordResetAction, initial);

  const state = mode === "signin" ? signInState : mode === "signup" ? signUpState : resetState;
  const action = mode === "signin" ? signIn : mode === "signup" ? signUp : reset;
  const busy = signingIn || signingUp || resetting;

  return (
    <form action={action} className="grid" style={{ gap: 12 }}>
      <input type="hidden" name="next" value={next} />
      <Field label={t("auth.email")}>
        <input
          style={inputStyle}
          name="email"
          type="email"
          autoComplete="email"
          required
          dir="ltr"
        />
      </Field>
      {mode !== "reset" && (
        <Field label={t("auth.password")}>
          <input
            style={inputStyle}
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
            dir="ltr"
          />
        </Field>
      )}
      {mode === "signup" && (
        <p className="muted" style={{ fontSize: ".82rem", margin: 0 }}>
          {t("auth.signupHint")}
        </p>
      )}
      <button className="btn-primary" type="submit" disabled={busy}>
        {busy
          ? "…"
          : mode === "signin"
            ? t("auth.signIn")
            : mode === "signup"
              ? t("auth.createLogin")
              : t("auth.sendReset")}
      </button>
      {state.message && <Notice msg={{ ok: state.ok, text: state.message }} />}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: ".85rem" }}>
        {mode !== "signin" && (
          <button type="button" className="linklike" onClick={() => setMode("signin")}>
            {t("auth.haveLogin")}
          </button>
        )}
        {mode !== "signup" && (
          <button type="button" className="linklike" onClick={() => setMode("signup")}>
            {t("auth.firstTime")}
          </button>
        )}
        {mode !== "reset" && (
          <button type="button" className="linklike" onClick={() => setMode("reset")}>
            {t("auth.forgot")}
          </button>
        )}
      </div>
    </form>
  );
}
