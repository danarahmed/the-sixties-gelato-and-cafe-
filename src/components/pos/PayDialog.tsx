"use client";

import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { normaliseNumber } from "@/lib/validation";
import type { Tender } from "./model";

/** Notes a customer is likely to hand over for this total: the next round sums above it. */
export function suggestedCash(total: number): number[] {
  const out = new Set<number>();
  for (const step of [1000, 5000, 10000, 25000, 50000]) {
    const up = Math.ceil(total / step) * step;
    if (up > total) out.add(up);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

/**
 * Taking the money. For cash, the cashier enters what was handed over (or
 * taps a note) and the change is worked out; nothing is recorded until
 * Confirm, and Confirm records it once however often it is pressed.
 */
export function PayDialog({
  title,
  total,
  tenders,
  initialTender,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  total: number;
  tenders: Tender[];
  initialTender: Tender;
  busy: boolean;
  error: string | null;
  onConfirm: (tender: Tender, received: number | null) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [tender, setTender] = useState<Tender>(initialTender);
  const [received, setReceived] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tender === "cash") input.current?.focus();
  }, [tender]);

  const typed = normaliseNumber(received);
  const cash = /^\d+(\.\d+)?$/.test(typed) ? new Decimal(typed) : null;
  const short = tender === "cash" && cash !== null && cash.lessThan(total);
  const change = tender === "cash" && cash !== null && !short ? cash.minus(total) : null;
  const canConfirm = !busy && !short;

  function confirm() {
    if (!canConfirm) return;
    onConfirm(tender, tender === "cash" && cash !== null ? cash.toNumber() : null);
  }

  return (
    <div className="pos-modal-back" onClick={() => !busy && onClose()}>
      <div
        className="pos-modal pay-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("pos.takePayment")}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Enter") {
            e.preventDefault();
            confirm();
          }
        }}
      >
        <div className="pay-head">
          <span className="muted">{title}</span>
          <span className="pay-total mono">{fmtIQD(total)}</span>
        </div>

        {tenders.length > 1 && (
          <div className="seg" role="radiogroup" aria-label={t("pos.howPaid")}>
            {tenders.map((x) => (
              <button
                key={x}
                role="radio"
                aria-checked={tender === x}
                className={tender === x ? "active" : ""}
                onClick={() => setTender(x)}
                disabled={busy}
              >
                {x === "cash" ? "💵 " : x === "card" ? "💳 " : "🧾 "}
                {t(`pos.tender.${x}`)}
              </button>
            ))}
          </div>
        )}

        {tender === "cash" && (
          <div className="cash-box">
            <label className="muted" htmlFor="cash-received" style={{ fontSize: ".85rem" }}>
              {t("pos.cashReceived")}
            </label>
            <input
              id="cash-received"
              ref={input}
              inputMode="decimal"
              autoComplete="off"
              className="cash-input mono"
              placeholder={fmtIQD(total)}
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              disabled={busy}
            />
            <div className="cash-quick">
              <button onClick={() => setReceived(String(total))} disabled={busy}>
                {t("pos.exact")}
              </button>
              {suggestedCash(total).map((n) => (
                <button
                  key={n}
                  className="mono"
                  onClick={() => setReceived(String(n))}
                  disabled={busy}
                >
                  {n.toLocaleString("en-US")}
                </button>
              ))}
            </div>
            <div className="change-row">
              {short ? (
                <span className="red">
                  {t("pos.stillOwed")}{" "}
                  <strong className="mono">
                    {fmtIQD(new Decimal(total).minus(cash!).toNumber())}
                  </strong>
                </span>
              ) : (
                <>
                  <span>{t("pos.changeDue")}</span>
                  <strong className="mono change-amt">{fmtIQD(change?.toNumber() ?? 0)}</strong>
                </>
              )}
            </div>
          </div>
        )}
        {tender === "platform_paid" && <p className="muted">{t("pos.platformNote")}</p>}

        {error && (
          <div className="badge err" style={{ whiteSpace: "normal", marginTop: 8 }}>
            ⚠️ {error}
          </div>
        )}

        <div className="pay-actions">
          <button onClick={onClose} disabled={busy}>
            {t("pos.back")}
          </button>
          <button className="btn-primary pay-confirm" onClick={confirm} disabled={!canConfirm}>
            {busy ? "…" : `${t("pos.confirmPayment")} · ${fmtIQD(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
