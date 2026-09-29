"use client";

import { useState, useTransition } from "react";
import { saveCustomerAction } from "@/lib/actions/customers";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

/**
 * A customer added, or their details changed (0050): a name, a phone number
 * typed any way (the database keeps it one way, and refuses one another
 * customer has), and notes (what they like, what to avoid).
 */
export function CustomerForm({
  customer,
  phone: typedPhone = "",
  onDone,
  onCancel,
}: {
  customer?: { id: string; name: string; phone: string; notes: string | null };
  /** A number typed at the till, found on nobody. */
  phone?: string;
  onDone: (saved: { customerId: string; phone: string }) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? typedPhone);
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await op.run("saveCustomer", (key) =>
        saveCustomerAction({ customerId: customer?.id ?? null, name, phone, notes }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      onDone(r.data);
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="customer-form">
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <Field label={t("Name")}>
          <input
            style={inputStyle}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t("Phone")}>
          <input
            style={inputStyle}
            value={phone}
            dir="ltr"
            inputMode="tel"
            maxLength={40}
            placeholder="0770 123 4567"
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </div>
      <Field label={t("Notes about them")}>
        <input
          style={inputStyle}
          value={notes}
          maxLength={500}
          placeholder={t("What they like, what to leave out")}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !name.trim() || !phone.trim()}
          onClick={save}
        >
          {customer ? t("Save") : t("Add the customer")}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          {t("Cancel")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}
