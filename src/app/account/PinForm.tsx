"use client";

import { useState, useTransition } from "react";
import { setMyPinAction } from "@/lib/actions/approvals";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { normaliseNumber } from "@/lib/validation";

const digits = (v: string) => normaliseNumber(v).replace(/\D/g, "").slice(0, 8);

/** The PIN a manager approves with on the till (0028); the database keeps only its hash. */
export function PinForm({ hasPin }: { hasPin: boolean }) {
  const { t } = useT();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState(hasPin);
  return (
    <form
      className="grid"
      style={{ gap: 10, maxWidth: 380 }}
      data-testid="pin-form"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await setMyPinAction({ pin, confirm });
          if (!r.ok) {
            setMsg({ ok: false, text: r.error });
            return;
          }
          setPin("");
          setConfirm("");
          setSaved(true);
          setMsg({ ok: true, text: t("account.pinSaved") });
        });
      }}
    >
      <p className="muted" style={{ margin: 0, fontSize: ".88rem" }}>
        {saved ? t("account.pinSet") : t("account.pinNone")}
      </p>
      <Field label={t("account.newPin")}>
        <input
          style={inputStyle}
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(digits(e.target.value))}
          required
        />
      </Field>
      <Field label={t("account.confirmPin")}>
        <input
          style={inputStyle}
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={confirm}
          onChange={(e) => setConfirm(digits(e.target.value))}
          required
        />
      </Field>
      <button
        className="btn-primary"
        type="submit"
        disabled={busy || pin.length < 4 || confirm.length < 4}
        style={{ justifySelf: "start" }}
      >
        {busy ? "…" : t("account.savePin")}
      </button>
      {msg && <Notice msg={msg} />}
    </form>
  );
}
