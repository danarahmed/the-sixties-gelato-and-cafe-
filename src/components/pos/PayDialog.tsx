"use client";

import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { cleanOrderNo, normaliseNumber, ORDER_NO } from "@/lib/validation";
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
 * Confirm, and Confirm records it once however often it is pressed. A
 * delivery platform's sale takes the order number its tablet shows: the
 * platform's payout is matched to the sale by it (0030).
 */
export function PayDialog({
  title,
  total,
  note,
  tenders,
  initialTender,
  platform,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  /** What the customer pays: the bill less any discount. */
  total: number;
  /** The discount taken off, when there is one. */
  note: string | null;
  tenders: Tender[];
  initialTender: Tender;
  /** The delivery platform's name, for its sale: "Talabat". */
  platform?: string | null;
  busy: boolean;
  error: string | null;
  onConfirm: (tender: Tender, received: number | null, orderNo: string | null) => void;
  onClose: () => void;
}) {
  const { t, msg } = useT();
  const [tender, setTender] = useState<Tender>(initialTender);
  const [received, setReceived] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const orderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tender === "cash") input.current?.focus();
    if (tender === "platform_paid") orderInput.current?.focus();
  }, [tender]);

  const typed = normaliseNumber(received);
  const cash = /^\d+(\.\d+)?$/.test(typed) ? new Decimal(typed) : null;
  const short = tender === "cash" && cash !== null && cash.lessThan(total);
  const change = tender === "cash" && cash !== null && !short ? cash.minus(total) : null;
  const number = cleanOrderNo(orderNo);
  const numberBad = number !== "" && !ORDER_NO.test(number);
  const needsNumber = tender === "platform_paid" && (number === "" || numberBad);
  const canConfirm = !busy && !short && !needsNumber;
  const platformName = platform ?? t("pos.tender.platform_paid");

  function confirm() {
    if (!canConfirm) return;
    onConfirm(
      tender,
      tender === "cash" && cash !== null ? cash.toNumber() : null,
      tender === "platform_paid" ? number : null,
    );
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
          {note && <span className="muted pay-note">{note}</span>}
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
        {tender === "platform_paid" && (
          <div className="cash-box">
            <label className="muted" htmlFor="platform-order-no" style={{ fontSize: ".85rem" }}>
              {t("pos.orderNo").replace("{platform}", platformName)}
            </label>
            <input
              id="platform-order-no"
              ref={orderInput}
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
              className="cash-input mono"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              disabled={busy}
              aria-invalid={numberBad}
            />
            {numberBad ? (
              <span className="red" style={{ fontSize: ".85rem" }}>
                {t("pos.orderNoFormat")}
              </span>
            ) : (
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {t("pos.orderNoHint").replace("{platform}", platformName)}
              </span>
            )}
            <p className="muted" style={{ fontSize: ".85rem", margin: 0 }}>
              {t("pos.platformNote")}
            </p>
          </div>
        )}

        {error && (
          <div className="badge err" style={{ whiteSpace: "normal", marginTop: 8 }}>
            ⚠️ {msg(error)}
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
