"use client";

import { fmtIQD } from "@/lib/format";
import type { PostedPayment } from "@/lib/expenses";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * A payment like this one posted already (the September audit's P2-14: rent
 * posted twice): which ones, and a tick that this is another payment, without
 * which it is not posted. Said as it changes, to a screen reader too.
 */
export function SamePaymentNote({
  same,
  accepted,
  onAccept,
}: {
  same: PostedPayment[];
  accepted: boolean;
  onAccept: (yes: boolean) => void;
}) {
  const { t } = useT();
  return (
    <div
      role="status"
      data-testid="same-payment"
      style={{ fontSize: ".8rem", color: "var(--warn)", marginBlockStart: same.length ? 8 : 0 }}
    >
      {same.length > 0 && (
        <>
          <div>⚠️ {t("A payment like this one is posted already:")}</div>
          <ul style={{ margin: "4px 0", paddingInlineStart: 18 }}>
            {same.map((x, i) => (
              <li key={`${x.journalNo ?? "-"}-${x.date}-${i}`}>
                <bdi>{x.date}</bdi> · {x.description} · {fmtIQD(x.amount)}
                {x.journalNo !== null && <> · {t("Journal {no}", { no: x.journalNo })}</>}
              </li>
            ))}
          </ul>
          <label style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--text)" }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => onAccept(e.target.checked)}
              data-testid="same-payment-ok"
            />
            {t("It is another payment, not the same one")}
          </label>
        </>
      )}
    </div>
  );
}
