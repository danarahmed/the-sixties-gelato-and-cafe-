"use client";

import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { cleanOrderNo, normaliseNumber, ORDER_NO } from "@/lib/validation";
import { checkSplit, type Payment, type SplitRow } from "@/lib/payments";
import {
  checkDollars,
  dollarsFor,
  fmtRate,
  fmtUSD,
  suggestedDollars,
  type RestWay,
} from "@/lib/fx";
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

/** A split starts as part by card and the rest in cash (0042). */
const SPLIT_START: SplitRow[] = [
  { type: "card", amount: "" },
  { type: "cash", amount: "" },
];

/**
 * Taking the money. For cash, the cashier enters what was handed over (or
 * taps a note) and the change is worked out; nothing is recorded until
 * Confirm, and Confirm records it once however often it is pressed. A
 * delivery platform's sale takes the order number its tablet shows: the
 * platform's payout is matched to the sale by it (0030).
 *
 * Split (0042): part by card and part in cash, or two cards. Each part is
 * typed but the last, which takes what is left; the cash handed over for the
 * cash part gives the change. Confirm stays off until the parts come to the
 * total.
 *
 * Dollars (0043), while a manager's rate is recent enough: the dollars handed
 * over, at that rate, rounded as the café counts them. Worth the total or
 * more, the change is given in dinars; worth less, the rest is paid in dinars
 * or by card. The database values them again at the rate now, and refuses the
 * payment if the rate changed meanwhile.
 */
export function PayDialog({
  title,
  total: billed,
  note,
  tenders,
  initialTender,
  platform,
  fx = null,
  dollarsOffHours = null,
  busy,
  error,
  reward = null,
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
  /** The dollar's rate and the step dollars are counted to, when dollars may be taken (0043). */
  fx?: { rate: number; roundTo: number } | null;
  /** Dollars are not taken now: the rate is this many hours old. */
  dollarsOffHours?: number | null;
  busy: boolean;
  error: string | null;
  /**
   * The order's customer and the rewards their points come to (0050): each
   * takes its value off, whole; a reward is the bill's only discount, so
   * `blocked` says why none can be taken (another discount on the bill).
   */
  reward?: {
    name: string;
    /** Their points now. */
    points: number;
    /** The rewards those come to. */
    available: number;
    /** What one reward takes off, and the points it takes. */
    value: number;
    each: number;
    blocked: string | null;
  } | null;
  onConfirm: (payments: Payment[], orderNo: string | null, rewards: number) => void;
  onClose: () => void;
}) {
  const { t, msg } = useT();
  const [rewards, setRewards] = useState(0);
  // Rewards the bill can take, whole: never more than it comes to.
  const maxRewards =
    reward && !reward.blocked && reward.value > 0
      ? Math.min(reward.available, Math.floor(billed / reward.value))
      : 0;
  const taken = Math.min(rewards, maxRewards);
  const off = taken * (reward?.value ?? 0);
  const total = billed - off;
  const [tender, setTender] = useState<Tender | "split" | "usd">(initialTender);
  const [received, setReceived] = useState("");
  const [rows, setRows] = useState<SplitRow[]>(SPLIT_START);
  const [splitReceived, setSplitReceived] = useState("");
  const [usdText, setUsdText] = useState("");
  const [restWay, setRestWay] = useState<RestWay>("cash");
  const [restReceived, setRestReceived] = useState("");
  // Dollars are cash: taken where cash is, at a rate recent enough.
  const canDollars = fx !== null && tenders.includes("cash");
  const usdInput = useRef<HTMLInputElement>(null);
  // Part in cash and part by card: only where both can be taken.
  const canSplit = tenders.includes("cash") && tenders.includes("card");
  const [orderNo, setOrderNo] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const orderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tender === "cash") input.current?.focus();
    if (tender === "platform_paid") orderInput.current?.focus();
    if (tender === "usd") usdInput.current?.focus();
  }, [tender]);

  const typed = normaliseNumber(received);
  const cash = /^\d+(\.\d+)?$/.test(typed) ? new Decimal(typed) : null;
  const short = tender === "cash" && cash !== null && cash.lessThan(total);
  const change = tender === "cash" && cash !== null && !short ? cash.minus(total) : null;
  const number = cleanOrderNo(orderNo);
  const numberBad = number !== "" && !ORDER_NO.test(number);
  const needsNumber = tender === "platform_paid" && (number === "" || numberBad);
  const split = tender === "split" ? checkSplit(total, rows, splitReceived) : null;
  const dollars =
    tender === "usd" && fx
      ? checkDollars(total, fx.rate, fx.roundTo, usdText, restWay, restReceived)
      : null;
  const canConfirm =
    !busy &&
    (split
      ? split.payments !== null
      : dollars
        ? dollars.payments !== null
        : !short && !needsNumber);
  const platformName = platform ?? t("pos.tender.platform_paid");

  function confirm() {
    if (!canConfirm) return;
    if (split) {
      if (split.payments) onConfirm(split.payments, null, taken);
      return;
    }
    if (dollars) {
      if (dollars.payments) onConfirm(dollars.payments, null, taken);
      return;
    }
    const one = tender as Tender;
    onConfirm(
      [
        {
          type: one,
          amount: total,
          received: one === "cash" && cash !== null ? cash.toNumber() : null,
        },
      ],
      one === "platform_paid" ? number : null,
      taken,
    );
  }

  const setRow = (i: number, row: Partial<SplitRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...row } : r)));
  const splitProblem = (() => {
    if (!split) return null;
    switch (split.problem) {
      case "notNumber":
        return t("Amounts are whole dinars");
      case "missing":
        return t("Type how much each payment is");
      case "zero":
        return t("Each payment needs an amount more than 0");
      case "over":
        return t("The payments come to {amount} more than the total", {
          amount: fmtIQD(split.over || -split.rest),
        });
      case "short":
        return `${t("pos.stillOwed")} ${fmtIQD(split.short)}`;
      default:
        return null;
    }
  })();

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
          <span className="pay-total mono" data-testid="pay-total">
            {fmtIQD(total)}
          </span>
          {note && <span className="muted pay-note">{note}</span>}
          {taken > 0 && (
            <span className="muted pay-note" data-testid="pay-reward-note">
              {t("{n} reward(s): {amount} off, {points} points", {
                n: String(taken),
                amount: fmtIQD(off),
                points: String(taken * (reward?.each ?? 0)),
              })}
            </span>
          )}
        </div>

        {reward && (
          <div className="card grid" style={{ gap: 6, padding: 10 }} data-testid="pay-reward">
            <span>
              {t("{name} has {n} points.", { name: reward.name, n: String(reward.points) })}
            </span>
            {reward.blocked ? (
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {msg(reward.blocked)}
              </span>
            ) : maxRewards === 0 ? (
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {reward.available === 0
                  ? t("Not enough for a reward yet.")
                  : t("A reward takes {amount} off, whole: the bill comes to less.", {
                      amount: fmtIQD(reward.value),
                    })}
              </span>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setRewards(Math.max(0, taken - 1))}
                  disabled={busy || taken === 0}
                  aria-label={t("pos.less")}
                >
                  −
                </button>
                <span className="mono" data-testid="pay-rewards">
                  {taken}
                </span>
                <button
                  type="button"
                  onClick={() => setRewards(Math.min(maxRewards, taken + 1))}
                  disabled={busy || taken >= maxRewards}
                  aria-label={t("pos.more")}
                  data-testid="pay-reward-more"
                >
                  +
                </button>
                <span className="muted" style={{ fontSize: ".85rem" }}>
                  {t("rewards taken, {amount} off each", { amount: fmtIQD(reward.value) })}
                </span>
              </div>
            )}
          </div>
        )}

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
            {canDollars && (
              <button
                role="radio"
                aria-checked={tender === "usd"}
                className={tender === "usd" ? "active" : ""}
                onClick={() => setTender("usd")}
                disabled={busy}
                data-testid="pay-usd"
              >
                $ {t("Dollars")}
              </button>
            )}
            {canSplit && (
              <button
                role="radio"
                aria-checked={tender === "split"}
                className={tender === "split" ? "active" : ""}
                onClick={() => setTender("split")}
                disabled={busy}
                data-testid="pay-split"
              >
                ➗ {t("Split")}
              </button>
            )}
          </div>
        )}

        {dollarsOffHours !== null && tenders.includes("cash") && (
          <p className="muted" style={{ fontSize: ".8rem", margin: 0 }} data-testid="usd-off">
            {t(
              "No dollars now: the rate was set {n} hours ago. A manager sets today's on Sales → Dollars.",
              { n: dollarsOffHours },
            )}
          </p>
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
        {split && (
          <div className="cash-box" data-testid="split-box">
            {rows.map((r, i) => {
              const last = i === rows.length - 1;
              const cashElsewhere = rows.some((o, j) => j !== i && o.type === "cash");
              return (
                <div key={i} className="split-row" data-testid="split-row">
                  <select
                    aria-label={t("How payment {n} is made", { n: i + 1 })}
                    value={r.type}
                    onChange={(e) => setRow(i, { type: e.target.value as SplitRow["type"] })}
                    disabled={busy}
                  >
                    {(["cash", "card"] as const).map((x) => (
                      <option key={x} value={x} disabled={x === "cash" && cashElsewhere}>
                        {t(`pos.tender.${x}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={t("Amount of payment {n}", { n: i + 1 })}
                    inputMode="numeric"
                    autoComplete="off"
                    className="mono"
                    value={r.amount}
                    placeholder={last && split.rest > 0 ? fmtIQD(split.rest) : ""}
                    onChange={(e) => setRow(i, { amount: e.target.value })}
                    disabled={busy}
                  />
                  {rows.length > 2 && (
                    <button
                      aria-label={t("Take off payment {n}", { n: i + 1 })}
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      disabled={busy}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            {rows.length < 4 && (
              <button
                data-testid="split-add"
                onClick={() => setRows((rs) => [...rs, { type: "card", amount: "" }])}
                disabled={busy}
                style={{ justifySelf: "start" }}
              >
                + {t("Add a payment")}
              </button>
            )}
            <span className="muted" style={{ fontSize: ".85rem" }}>
              {t("The last payment takes what is left.")}
            </span>
            {splitProblem && (
              <span className="red" style={{ fontSize: ".85rem" }} data-testid="split-problem">
                {splitProblem}
              </span>
            )}
            {split.cash !== null && split.cash > 0 && (
              <>
                <label className="muted" htmlFor="split-received" style={{ fontSize: ".85rem" }}>
                  {t("pos.cashReceived")} · {fmtIQD(split.cash)}
                </label>
                <input
                  id="split-received"
                  inputMode="decimal"
                  autoComplete="off"
                  className="cash-input mono"
                  placeholder={fmtIQD(split.cash)}
                  value={splitReceived}
                  onChange={(e) => setSplitReceived(e.target.value)}
                  disabled={busy}
                />
                <div className="cash-quick">
                  {suggestedCash(split.cash).map((n) => (
                    <button
                      key={n}
                      className="mono"
                      onClick={() => setSplitReceived(String(n))}
                      disabled={busy}
                    >
                      {n.toLocaleString("en-US")}
                    </button>
                  ))}
                </div>
                <div className="change-row" data-testid="split-change">
                  {split.problem === "cashShort" && split.received !== null ? (
                    <span className="red">
                      {t("pos.stillOwed")}{" "}
                      <strong className="mono">{fmtIQD(split.cash - split.received)}</strong>
                    </span>
                  ) : (
                    <>
                      <span>{t("pos.changeDue")}</span>
                      <strong className="mono change-amt">{fmtIQD(split.change ?? 0)}</strong>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {dollars && fx && (
          <div className="cash-box" data-testid="usd-box">
            <label className="muted" htmlFor="usd-received" style={{ fontSize: ".85rem" }}>
              {t("Dollars handed over")} · {t("{rate} dinars a dollar", { rate: fmtRate(fx.rate) })}
            </label>
            <input
              id="usd-received"
              ref={usdInput}
              inputMode="numeric"
              autoComplete="off"
              className="cash-input mono"
              placeholder={fmtUSD(dollarsFor(total, fx.rate, fx.roundTo))}
              value={usdText}
              onChange={(e) => setUsdText(e.target.value)}
              disabled={busy}
            />
            <div className="cash-quick">
              {suggestedDollars(total, fx.rate, fx.roundTo).map((n) => (
                <button
                  key={n}
                  className="mono"
                  onClick={() => setUsdText(String(n))}
                  disabled={busy}
                >
                  {fmtUSD(n)}
                </button>
              ))}
            </div>
            {dollars.problem === "notNumber" && (
              <span className="red" style={{ fontSize: ".85rem" }}>
                {t("Dollars are taken in whole dollars")}
              </span>
            )}
            {dollars.value !== null && dollars.usd !== null && (
              <span className="muted" style={{ fontSize: ".85rem" }} data-testid="usd-value">
                {t("{usd} are {amount}", {
                  usd: fmtUSD(dollars.usd),
                  amount: fmtIQD(dollars.value),
                })}
              </span>
            )}
            {dollars.value !== null && dollars.rest === 0 && (
              <div className="change-row" data-testid="usd-change">
                <span>{t("Change, in dinars")}</span>
                <strong className="mono change-amt">{fmtIQD(dollars.change ?? 0)}</strong>
              </div>
            )}
            {dollars.value !== null && dollars.rest > 0 && (
              <>
                <span style={{ fontSize: ".9rem" }} data-testid="usd-rest">
                  {t("The other {amount} is paid", { amount: fmtIQD(dollars.rest) })}
                </span>
                <div className="seg" role="radiogroup" aria-label={t("The rest is paid")}>
                  {(["cash", "card"] as const).map((x) => (
                    <button
                      key={x}
                      role="radio"
                      aria-checked={restWay === x}
                      className={restWay === x ? "active" : ""}
                      onClick={() => setRestWay(x)}
                      disabled={busy}
                    >
                      {x === "cash" ? "💵 " : "💳 "}
                      {t(`pos.tender.${x}`)}
                    </button>
                  ))}
                </div>
                {restWay === "cash" && (
                  <>
                    <label
                      className="muted"
                      htmlFor="usd-rest-received"
                      style={{ fontSize: ".85rem" }}
                    >
                      {t("pos.cashReceived")} · {fmtIQD(dollars.rest)}
                    </label>
                    <input
                      id="usd-rest-received"
                      inputMode="decimal"
                      autoComplete="off"
                      className="cash-input mono"
                      placeholder={fmtIQD(dollars.rest)}
                      value={restReceived}
                      onChange={(e) => setRestReceived(e.target.value)}
                      disabled={busy}
                    />
                    <div className="change-row">
                      {dollars.problem === "restShort" && dollars.restReceived !== null ? (
                        <span className="red">
                          {t("pos.stillOwed")}{" "}
                          <strong className="mono">
                            {fmtIQD(dollars.rest - dollars.restReceived)}
                          </strong>
                        </span>
                      ) : (
                        <>
                          <span>{t("pos.changeDue")}</span>
                          <strong className="mono change-amt">
                            {fmtIQD(dollars.restChange ?? 0)}
                          </strong>
                        </>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
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
