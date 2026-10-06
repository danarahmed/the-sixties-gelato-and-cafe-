"use client";
/**
 * Sales → Ways to pay (0069): what each of the café's ways to pay holds in its
 * account (FIB, FastPay…), beside the bank and the safe; the money moved out
 * of them (to the bank, the safe or another, less what the bank or the app
 * kept), or a charge alone; and each move, cancelled with why.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMoneyMoveAction, moveMoneyAction } from "@/lib/actions/paymentMethods";
import { BANK, SAFE, moveIsAllowed, type MoneyAccounts } from "@/lib/paymentMethods";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;
/** No place to go: a charge alone. */
const CHARGE = "charge";

export function MoneyAccountsPanel({
  accounts,
  canMove,
  today,
  timezone,
}: {
  accounts: MoneyAccounts;
  /** accounting.post: money is moved and moves cancelled. */
  canMove: boolean;
  today: string;
  timezone: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const methods = accounts.methods;
  // Each account by its code: a way to pay by its name, the bank and the safe in words.
  const placeName = (code: string | null) =>
    code === null
      ? t("a charge")
      : code === BANK
        ? t("the bank")
        : code === SAFE
          ? t("the safe")
          : (methods.find((m) => m.account === code)?.name ?? code);
  const holding = methods.filter((m) => m.balance > 0);
  const [from, setFrom] = useState(holding[0]?.account ?? methods[0]?.account ?? BANK);
  const [to, setTo] = useState<string>(BANK);
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [on, setOn] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [cancelling, setCancelling] = useState<{ id: string; reason: string } | null>(null);
  const charge = to === CHARGE;
  const target = charge ? null : to;
  const allowed = moveIsAllowed(from, target, methods);
  const balanceOf = (code: string) =>
    code === BANK
      ? accounts.bank
      : code === SAFE
        ? accounts.safe
        : (methods.find((m) => m.account === code)?.balance ?? 0);
  const amountN = Number(normaliseNumber(amount) || "0");
  const feeN = Number(normaliseNumber(fee) || "0");
  const ready =
    allowed &&
    !busy &&
    Number.isFinite(amountN) &&
    Number.isFinite(feeN) &&
    (charge ? feeN > 0 : amountN > 0);

  function move() {
    if (!ready) return;
    setMsg(null);
    start(async () => {
      const r = await op.run("moveMoney", (key) =>
        moveMoneyAction(
          {
            from,
            to: target,
            amount: charge ? "0" : normaliseNumber(amount),
            fee: normaliseNumber(fee) || "0",
            on,
            reference,
            note,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({
        ok: true,
        text: charge
          ? t("Charge of {fee} taken by {from} recorded (journal {journal}).", {
              fee: fmtIQD(feeN),
              from: placeName(from),
              journal: r.data.journalNo ?? "—",
            })
          : t("Moved {amount} from {from} to {to} (journal {journal}).", {
              amount: fmtIQD(amountN),
              from: placeName(from),
              to: placeName(target),
              journal: r.data.journalNo ?? "—",
            }),
      });
      setAmount("");
      setFee("");
      setReference("");
      setNote("");
      router.refresh();
    });
  }

  function cancel() {
    if (!cancelling || cancelling.reason.trim().length < 3) return;
    const c = cancelling;
    setMsg(null);
    start(async () => {
      const r = await op.run("cancelMove", (key) =>
        cancelMoneyMoveAction({ id: c.id, reason: c.reason }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: t("The move is cancelled: its journal is reversed today.") });
      setCancelling(null);
      router.refresh();
    });
  }

  return (
    <div className="panel-b grid" style={{ gap: 14 }} data-testid="money-accounts">
      <div className="money-tiles">
        {methods.map((m) => (
          <div key={m.id} className="money-tile" data-testid="money-tile">
            <div className="sc" dir="auto">
              {m.name}
              {!m.active && <span className="muted"> · {t("out of use")}</span>}
            </div>
            <div className={`v ${m.balance < 0 ? "red" : ""}`}>{fmtIQD(m.balance)}</div>
            <div className="m mono">{t("account {code}", { code: m.account })}</div>
          </div>
        ))}
        <div className="money-tile quiet">
          <div className="sc">{t("The bank")}</div>
          <div className="v">{fmtIQD(accounts.bank)}</div>
          <div className="m mono">{t("account {code}", { code: BANK })}</div>
        </div>
        <div className="money-tile quiet">
          <div className="sc">{t("The safe")}</div>
          <div className="v">{fmtIQD(accounts.safe)}</div>
          <div className="m mono">{t("account {code}", { code: SAFE })}</div>
        </div>
      </div>

      {canMove && methods.length > 0 && (
        <div className="grid" style={{ gap: 8 }} data-testid="move-money">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ minWidth: 140 }}>
              <div className="sc">{t("From")}</div>
              <select
                aria-label={t("Money from")}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                {methods.map((m) => (
                  <option key={m.account} value={m.account}>
                    {m.name} · {fmtIQD(m.balance)}
                  </option>
                ))}
                <option value={BANK}>{t("the bank")}</option>
                <option value={SAFE}>{t("the safe")}</option>
              </select>
            </label>
            <label style={{ minWidth: 140 }}>
              <div className="sc">{t("To")}</div>
              <select aria-label={t("Money to")} value={to} onChange={(e) => setTo(e.target.value)}>
                <option value={BANK}>{t("the bank")}</option>
                <option value={SAFE}>{t("the safe, as cash")}</option>
                {methods
                  .filter((m) => m.account !== from)
                  .map((m) => (
                    <option key={m.account} value={m.account}>
                      {m.name}
                    </option>
                  ))}
                <option value={CHARGE}>{t("Nowhere: a charge alone")}</option>
              </select>
            </label>
            {!charge && (
              <label style={{ minWidth: 120 }}>
                <div className="sc">{t("What arrived (IQD)")}</div>
                <input
                  aria-label={t("What arrived")}
                  className="amt"
                  style={{ textAlign: "end" }}
                  inputMode="decimal"
                  placeholder={from !== BANK ? fmtIQD(Math.max(0, balanceOf(from))) : ""}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            )}
            <label style={{ minWidth: 110 }}>
              <div className="sc">{charge ? t("The charge (IQD)") : t("Fee kept (IQD)")}</div>
              <input
                aria-label={charge ? t("The charge") : t("Fee kept")}
                className="amt"
                style={{ textAlign: "end" }}
                inputMode="decimal"
                placeholder="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </label>
            <label style={{ minWidth: 140 }}>
              <div className="sc">{t("Day")}</div>
              <input
                type="date"
                aria-label={t("The day it moved")}
                max={today}
                value={on}
                onChange={(e) => setOn(e.target.value)}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ minWidth: 160 }}>
              <div className="sc">{t("Reference (optional)")}</div>
              <input
                aria-label={t("Reference of the move")}
                maxLength={60}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label style={{ flex: 1, minWidth: 180 }}>
              <div className="sc">{t("Note (optional)")}</div>
              <input
                aria-label={t("Note on the move")}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              className="btn-primary"
              onClick={move}
              disabled={!ready}
              data-testid="move-money-go"
            >
              {busy ? t("Moving…") : charge ? t("Record the charge") : t("Move money")}
            </button>
          </div>
          {!allowed && (
            <span className="muted" style={{ fontSize: ".8rem" }}>
              {t(
                "Money moves out of a way to pay's account, or into one; the bank and the safe move cash on Move Cash.",
              )}
            </span>
          )}
        </div>
      )}

      <OperationStatus op={op} />
      <Notice msg={msg} />

      {accounts.moves.length > 0 && (
        <div className="tw">
          <table className="stack-table" data-testid="money-moves">
            <thead>
              <tr>
                <th>{t("Day")}</th>
                <th>{t("From → to")}</th>
                <th className="right">{t("Arrived")}</th>
                <th className="right">{t("Fee")}</th>
                <th>{t("Reference")}</th>
                <th>{t("By")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.moves.map((m) => (
                <tr key={m.id} className={m.cancelledAt ? "muted" : ""}>
                  <td data-label={t("Day")} className="when">
                    {m.on}
                  </td>
                  <td data-label={t("From → to")}>
                    {placeName(m.from)} → {placeName(m.to)}
                    {m.cancelledAt && (
                      <div style={{ fontSize: ".75rem" }}>
                        {t("Cancelled {when}: {reason}", {
                          when: dateTimeIn(timezone, m.cancelledAt),
                          reason: m.cancelReason ?? "",
                        })}
                      </div>
                    )}
                  </td>
                  <td data-label={t("Arrived")} className="right mono stack-half">
                    {m.to === null ? "—" : fmtIQD(m.amount)}
                  </td>
                  <td data-label={t("Fee")} className="right mono stack-half">
                    {m.fee > 0 ? fmtIQD(m.fee) : "—"}
                  </td>
                  <td data-label={t("Reference")}>
                    {[m.reference, m.note].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td data-label={t("By")} className="muted">
                    {m.by ?? "—"}
                    {m.journalNo !== null && (
                      <span className="mono"> · {t("journal {no}", { no: m.journalNo })}</span>
                    )}
                  </td>
                  <td className="right">
                    {canMove && !m.cancelledAt && cancelling?.id !== m.id && (
                      <button
                        disabled={busy}
                        onClick={() => setCancelling({ id: m.id, reason: "" })}
                      >
                        {t("Cancel")}
                      </button>
                    )}
                    {cancelling?.id === m.id && (
                      <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                        <input
                          aria-label={t("Why it is cancelled")}
                          placeholder={t("Why it is cancelled")}
                          value={cancelling.reason}
                          onChange={(e) => setCancelling({ id: m.id, reason: e.target.value })}
                          autoFocus
                        />
                        <button
                          className="btn-primary"
                          disabled={busy || cancelling.reason.trim().length < 3}
                          onClick={cancel}
                        >
                          {t("Cancel the move")}
                        </button>
                        <button disabled={busy} onClick={() => setCancelling(null)}>
                          {t("Keep it")}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
