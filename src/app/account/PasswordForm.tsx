"use client";

import { useActionState } from "react";
import { updatePasswordAction, type AuthFormState } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";

const initial: AuthFormState = { ok: false, message: null };

export function PasswordForm() {
  const { t } = useT();
  const [state, action, busy] = useActionState(updatePasswordAction, initial);
  return (
    <form action={action} className="grid" style={{ gap: 10, maxWidth: 380 }}>
      <Field label={t("account.newPassword")}>
        <input
          style={inputStyle}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <Field label={t("account.confirmPassword")}>
        <input
          style={inputStyle}
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <button
        className="btn-primary"
        type="submit"
        disabled={busy}
        style={{ justifySelf: "start" }}
      >
        {busy ? "…" : t("account.savePassword")}
      </button>
      {state.message && <Notice msg={{ ok: state.ok, text: state.message }} />}
    </form>
  );
}
