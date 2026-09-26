"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelCardSettlementAction, recordCardSettlementAction } from "@/lib/actions/settlements";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { cancellableCard, cardMath, tillThrough, type CardTakings } from "@/lib/settlements";

type Msg = { ok: boolean; text: string } | null;

const money = (d: { toNumber(): number } | null) => (d === null ? "—" : fmtIQD(d.toNumber()));

/**
 * Card takings, settled (0030). What the till took by card waits in 1010
 * Card clearing until the terminal's report and the bank say what arrived:
 * the bank's money goes to 1020, the card company's fee to 6500, and any
 * difference between the till and the terminal to 6300 with a note saying
 * why. Days are settled in order, from the day after the last settlement.
 */
export function CardTakingsPanel({
  takings,
  canSettle,
  today,
}: {
  takings: CardTakings;
  canSettle: boolean;
  today: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const days = takings.days;
  // A day is settled once it is over: the till takes cards until midnight.
  const over = days.filter((d) => d.day < today);
  const lastDay = over.length > 0 ? over[over.length - 1]!.day : null;
  const [through, setThrough] = useState(lastDay ?? "");
  const [terminal, setTerminal] = useState("");
  const [received, setReceived] = useState("");
  const [receivedOn, setReceivedOn] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const upTo = over.some((d) => d.day === through) ? through : (lastDay ?? "");
  const till = tillThrough(over, upTo);
  const m = cardMath(till, terminal, received);
  const needsNote = m.difference !== null && !m.difference.isZero();
  const canSubmit =
    !busy && over.length > 0 && m.problem === null && (!needsNote || note.trim().length >= 3);
  const waiting = days.reduce((s, d) => s + d.amount, 0);
  const cancellable = cancellableCard(takings.settlements);

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await recordCardSettlementAction({
        through: upTo,
        terminalTotal: terminal,
        received,
        receivedOn,
        reference,
        note,
      });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      const d = r.data;
      const vars = {
        journal: d.journalNo ?? "—",
        fee: fmtIQD(d.fee),
        difference: fmtIQD(Math.abs(d.difference)),
      };
      setMsg({
        ok: true,
        text:
          d.difference === 0
            ? t(
                "Settled (journal {journal}): {fee} card fee; the till and the terminal agree.",
                vars,
              )
            : d.difference > 0
              ? t(
                  "Settled (journal {journal}): {fee} card fee; {difference} more at the till than the terminal, to 6300.",
                  vars,
                )
              : t(
                  "Settled (journal {journal}): {fee} card fee; {difference} more at the terminal than the till, to 6300.",
                  vars,
                ),
      });
      setTerminal("");
      setReceived("");
      setReference("");
      setNote("");
      router.refresh();
    });
  }

  function cancel(id: string) {
    setMsg(null);
    start(async () => {
      const r = await cancelCardSettlementAction({ id, reason });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: t("Cancelled: its journal is reversed, and its days wait again.") });
      setCancelling(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="panel-b" data-testid="card-takings">
      <div className="grid" style={{ gap: 4, maxWidth: 560 }}>
        {days.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {takings.from
              ? t("Nothing taken by card is waiting to be settled: every day before {day} is.", {
                  day: takings.from,
                })
              : t("Nothing taken by card is waiting to be settled.")}
          </p>
        ) : (
          <>
            {days.map((d) => (
              <div className="deduction-row" key={d.day} data-testid="card-day">
                <span>
                  {d.day}
                  {d.day >= today ? (
                    <span className="muted"> · {t("today: settled once the day is over")}</span>
                  ) : (
                    d.day > upTo && <span className="muted"> · {t("not in this settlement")}</span>
                  )}
                </span>
                <span className="mono">{fmtIQD(d.amount)}</span>
              </div>
            ))}
            <div className="deduction-row" style={{ borderBlockStart: "1px solid var(--rule)" }}>
              <strong>{t("Waiting to be settled")}</strong>
              <strong className="mono">{fmtIQD(waiting)}</strong>
            </div>
          </>
        )}
        {takings.balance !== waiting && (
          <div className="deduction-row">
            <span className="muted">{t("1010 Card clearing holds")}</span>
            <span className="mono">{fmtIQD(takings.balance)}</span>
          </div>
        )}
      </div>

      {canSettle && days.length > 0 && over.length === 0 && (
        <p className="muted" style={{ margin: "12px 0 0", fontSize: ".85rem" }}>
          {t(
            "Today's card takings are settled once the day is over, from the terminal's report and the bank statement.",
          )}
        </p>
      )}

      {canSettle && over.length > 0 && (
        <div className="grid" style={{ gap: 12, marginBlockStart: 14, maxWidth: 720 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label>
              <div className="sc">{t("Settle the days up to")}</div>
              <select
                aria-label={t("Settle the days up to")}
                value={upTo}
                onChange={(e) => setThrough(e.target.value)}
              >
                {over.map((d) => (
                  <option key={d.day} value={d.day}>
                    {d.day}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="sc">{t("The till took by card")}</div>
              <div className="mono" data-testid="card-till" style={{ paddingBlock: 6 }}>
                {money(till)}
              </div>
            </div>
            <label style={{ minWidth: 160 }}>
              <div className="sc">{t("The terminal's total (IQD)")}</div>
              <input
                aria-label={t("The terminal's total")}
                className="amt"
                style={{ textAlign: "end" }}
                inputMode="decimal"
                value={terminal}
                onChange={(e) => setTerminal(e.target.value)}
                placeholder={till.toFixed()}
              />
            </label>
            <button type="button" onClick={() => setTerminal(till.toFixed())} disabled={busy}>
              {t("Same as the till")}
            </button>
            <label style={{ minWidth: 160 }}>
              <div className="sc">{t("Reached the bank (IQD)")}</div>
              <input
                aria-label={t("Reached the bank")}
                className="amt"
                style={{ textAlign: "end" }}
                inputMode="decimal"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label>
              <div className="sc">{t("Arrived on")}</div>
              <input
                aria-label={t("Arrived on")}
                type="date"
                value={receivedOn}
                min={upTo}
                max={today}
                onChange={(e) => setReceivedOn(e.target.value)}
              />
            </label>
            <label style={{ minWidth: 200 }}>
              <div className="sc">{t("Bank reference (optional)")}</div>
              <input
                aria-label={t("Bank reference")}
                value={reference}
                maxLength={80}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label style={{ flex: 1, minWidth: 240 }}>
              <div className="sc">
                {needsNote
                  ? t("Note: say why the till and the terminal differ")
                  : t("Note (optional)")}
              </div>
              <input
                aria-label={t("Note")}
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>

          <div className="grid" style={{ gap: 4, maxWidth: 560 }} data-testid="card-preview">
            {m.problem === "more_than_terminal" ? (
              <span className="red" style={{ fontSize: ".85rem" }}>
                {t(
                  "The bank cannot receive more than the terminal took: the difference is its fee.",
                )}
              </span>
            ) : (
              <>
                <div className="deduction-row">
                  <span>
                    <span className="muted">{t("Dr")}</span> 1020 {t("Bank")}
                  </span>
                  <span className="mono">{money(m.received)}</span>
                </div>
                <div className="deduction-row">
                  <span>
                    <span className="muted">{t("Dr")}</span> 6500 {t("Card and bank fees")}
                  </span>
                  <span className="mono" data-testid="card-fee">
                    {money(m.fee)}
                  </span>
                </div>
                {needsNote && m.difference && (
                  <div className="deduction-row">
                    <span>
                      <span className="muted">{m.difference.isPositive() ? t("Dr") : t("Cr")}</span>{" "}
                      6300{" "}
                      {m.difference.isPositive()
                        ? t("Cash over / short: the till took more by card than the terminal")
                        : t("Cash over / short: the terminal took more than the till")}
                    </span>
                    <span className="mono" data-testid="card-difference">
                      {fmtIQD(m.difference.abs().toNumber())}
                    </span>
                  </div>
                )}
                <div className="deduction-row">
                  <span>
                    <span className="muted">{t("Cr")}</span> 1010 {t("Card clearing")}
                  </span>
                  <span className="mono">{money(till)}</span>
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={submit} disabled={!canSubmit}>
              {busy ? "…" : t("Record the settlement")}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBlockStart: 12 }}>
        <Notice msg={msg} />
      </div>

      {takings.settlements.length > 0 && (
        <div className="tw" style={{ marginBlockStart: 14 }}>
          <table>
            <thead>
              <tr>
                <th>{t("Days")}</th>
                <th className="right">{t("Till")}</th>
                <th className="right">{t("Terminal")}</th>
                <th className="right">{t("To the bank")}</th>
                <th className="right">{t("Fee")}</th>
                <th className="right">{t("Difference")}</th>
                <th>{t("Arrived")}</th>
                <th>{t("Journal")}</th>
                <th>{t("By")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {takings.settlements.map((s) => (
                <tr
                  key={s.id}
                  data-testid="card-settlement"
                  style={s.cancelledAt ? { opacity: 0.6 } : undefined}
                >
                  <td className="mono" style={{ fontSize: ".8rem" }}>
                    {s.coversFrom === s.coversTo ? s.coversFrom : `${s.coversFrom} – ${s.coversTo}`}
                    {s.reference && <div className="muted">{s.reference}</div>}
                    {s.note && <div className="muted">{s.note}</div>}
                  </td>
                  <td className="right money">{fmtIQD(s.tillTotal)}</td>
                  <td className="right money">{fmtIQD(s.terminalTotal)}</td>
                  <td className="right money">{fmtIQD(s.received)}</td>
                  <td className="right money">{fmtIQD(s.fee)}</td>
                  <td
                    className="right money"
                    style={{ color: s.difference === 0 ? undefined : "var(--err)" }}
                  >
                    {s.difference === 0 ? "—" : fmtIQD(s.difference)}
                  </td>
                  <td className="mono" style={{ fontSize: ".8rem" }}>
                    {s.receivedOn}
                  </td>
                  <td className="mono">{s.journalNo ?? "—"}</td>
                  <td className="muted">{s.by ?? "—"}</td>
                  <td>
                    {s.cancelledAt ? (
                      <span className="ref due" title={s.cancelReason ?? undefined}>
                        {t("Cancelled")}
                      </span>
                    ) : canSettle && s.id === cancellable ? (
                      cancelling === s.id ? (
                        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                          <input
                            aria-label={t("Why it is cancelled")}
                            placeholder={t("Why it is cancelled")}
                            value={reason}
                            maxLength={300}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <button
                            onClick={() => cancel(s.id)}
                            disabled={busy || reason.trim().length < 3}
                          >
                            {t("Cancel it")}
                          </button>
                          <button onClick={() => setCancelling(null)} disabled={busy}>
                            {t("Keep")}
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setCancelling(s.id)} disabled={busy}>
                          {t("Cancel…")}
                        </button>
                      )
                    ) : null}
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
