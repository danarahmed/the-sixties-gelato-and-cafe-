"use client";

import { cashNote, type CashOnHand } from "@/lib/cash";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * Under a form's "Paid from" (AK): what the safe or the drawer holds, and a
 * warning when the payment is more than that, or the drawer is not open. The
 * database refuses such a payment, and this says so before it is sent. What
 * the drawer should hold is shown only to those who may see it (the count is
 * blind). Said as it changes, to a screen reader too.
 */
export function CashOnHandNote({
  on,
  from,
  amount,
}: {
  on: CashOnHand | null;
  from: string;
  amount: number;
}) {
  const { t } = useT();
  const note = cashNote(on, from, amount);
  return (
    <p
      role="status"
      data-testid="cash-on-hand"
      data-warn={note?.warn ? "yes" : "no"}
      className={note?.warn ? undefined : "muted"}
      style={{
        fontSize: ".8rem",
        margin: 0,
        color: note?.warn ? "var(--warn)" : undefined,
      }}
    >
      {note
        ? `${note.warn ? "⚠️ " : ""}${t(note.text, note.amount === null ? {} : { amount: fmtIQD(note.amount) })}`
        : null}
    </p>
  );
}
