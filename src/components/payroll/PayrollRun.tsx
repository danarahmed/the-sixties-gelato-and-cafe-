"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adjustPayrollLineAction,
  approvePayrollAction,
  cancelSalaryPaymentAction,
  draftPayrollAction,
  payPayrollAction,
  paySalaryAction,
  reopenPayrollAction,
} from "@/lib/actions/payroll";
import {
  PAID_FROM_LABEL,
  RATE_PER,
  RUN_STATUS_LABEL,
  STAFF_PAID_FROM,
  monthText,
  payrollTotals,
  splitMinutes,
  type PayrollDetail,
  type PayrollLine,
  type StaffPaidFrom,
} from "@/lib/staff";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

const BADGE: Record<string, string> = { draft: "badge warn", approved: "badge", paid: "badge ok" };

/**
 * One month's payroll (0049): each person's pay from their hours, what was
 * added and deducted with why, the advances taken back, what is to be paid and
 * what has been. A draft is adjusted and approved once the month is over; an
 * approved one is paid, to one person or to everyone at once, or reopened
 * while nothing is paid from it.
 */
export function PayrollRun({
  run,
  canRun,
  timezone,
}: {
  run: PayrollDetail;
  canRun: boolean;
  timezone: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState<{ what: "adjust" | "pay"; id: string } | null>(null);
  const totals = payrollTotals(run.lines);
  const draft = run.status === "draft";
  const livePayments = run.payments.filter((p) => p.cancelledAt === null);
  const hours = (minutes: number) => {
    const { h, m } = splitMinutes(minutes);
    return m === 0
      ? t("{h} h", { h: String(h) })
      : t("{h} h {m} min", { h: String(h), m: String(m) });
  };

  return (
    <div className="grid" style={{ gap: 16 }} data-testid="payroll-run" data-status={run.status}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>
          {t("Payroll {no}: {month}", { no: String(run.runNo), month: monthText(run.month) })}
        </h1>
        <span className={BADGE[run.status] ?? "badge"} data-testid="run-status">
          {t(RUN_STATUS_LABEL[run.status] ?? run.status)}
        </span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {run.draftedAt &&
          t("Drafted by {name}, {at}.", {
            name: run.draftedBy ?? "—",
            at: dateTimeIn(timezone, run.draftedAt),
          })}{" "}
        {run.approvedAt &&
          t("Approved by {name}, {at}: journal {no}.", {
            name: run.approvedBy ?? "—",
            at: dateTimeIn(timezone, run.approvedAt),
            no: String(run.journalNo ?? "—"),
          })}
      </p>

      {draft && run.current === false && (
        <div className="badge err" style={{ whiteSpace: "normal" }} data-testid="run-stale">
          {t(
            "The hours or the pay changed since this draft: draft it again, check it, then approve it.",
          )}
        </div>
      )}
      {draft && !run.monthOver && (
        <div className="badge warn" style={{ whiteSpace: "normal" }}>
          {t(
            "The month is not over: this draft shows what is owed so far, and is approved once the month is over.",
          )}
        </div>
      )}

      <div className="tw">
        <table data-testid="payroll-lines">
          <thead>
            <tr>
              <th>{t("Who")}</th>
              <th>{t("Pay")}</th>
              <th>{t("Worked")}</th>
              <th className="right">{t("Base")}</th>
              <th className="right">{t("Overtime")}</th>
              <th className="right">{t("Added")}</th>
              <th className="right">{t("Deducted")}</th>
              <th className="right">{t("Advance taken back")}</th>
              <th className="right">{t("To be paid")}</th>
              <th className="right">{t("Paid")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {run.lines.map((l) => (
              <LineRow
                key={l.id}
                l={l}
                run={run}
                hours={hours}
                canRun={canRun}
                open={open?.id === l.id ? open.what : null}
                setOpen={(what) => setOpen(what ? { what, id: l.id } : null)}
              />
            ))}
            <tr style={{ fontWeight: 600 }}>
              <td colSpan={3}>{t("Total")}</td>
              <td colSpan={4} />
              <td className="right money">{fmtIQD(totals.recovered)}</td>
              <td className="right money" data-testid="run-net">
                {fmtIQD(totals.net)}
              </td>
              <td className="right money">{fmtIQD(totals.paid)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {t(
          "The pay (gross) is the base and the overtime, with what was added and less what was deducted: approved, it is Dr 6100 Salaries; what is to be paid is Cr 2100 Salaries payable, and the advances taken back Cr 1300.",
        )}{" "}
        {t("Gross {gross}.", { gross: fmtIQD(totals.gross) })}
      </p>

      {canRun && <RunActions run={run} owed={totals.owed} hasPayments={livePayments.length > 0} />}

      {run.payments.length > 0 && (
        <section className="grid" style={{ gap: 8 }}>
          <h2 style={{ margin: 0 }}>{t("Salaries paid")}</h2>
          <div className="tw">
            <table data-testid="salary-payments">
              <thead>
                <tr>
                  <th>{t("Paid on")}</th>
                  <th>{t("To")}</th>
                  <th>{t("From")}</th>
                  <th className="right">{t("Amount")}</th>
                  <th>{t("Journal")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {run.payments.map((p) => (
                  <PaymentRow key={p.id} p={p} canRun={canRun} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {run.approvals.some((a) => a.reopenedAt) && (
        <section className="grid" style={{ gap: 6 }}>
          <h2 style={{ margin: 0 }}>{t("Approved before, and reopened")}</h2>
          {run.approvals
            .filter((a) => a.reopenedAt)
            .map((a, i) => (
              <p key={i} className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                {t("Approved by {name}, {at} (journal {no}); reopened by {by}, {when}: {why}", {
                  name: a.approvedBy ?? "—",
                  at: dateTimeIn(timezone, a.approvedAt),
                  no: String(a.journalNo ?? "—"),
                  by: a.reopenedBy ?? "—",
                  when: dateTimeIn(timezone, a.reopenedAt ?? ""),
                  why: a.reopenReason ?? "",
                })}
              </p>
            ))}
        </section>
      )}
    </div>
  );
}

function LineRow({
  l,
  run,
  hours,
  canRun,
  open,
  setOpen,
}: {
  l: PayrollLine;
  run: PayrollDetail;
  hours: (minutes: number) => string;
  canRun: boolean;
  open: "adjust" | "pay" | null;
  setOpen: (what: "adjust" | "pay" | null) => void;
}) {
  const { t } = useT();
  const owed = l.net - l.paid;
  return (
    <>
      <tr data-testid="payroll-line" data-name={l.name}>
        <td>
          <b>{l.name}</b>
          {l.title && (
            <div className="muted" style={{ fontSize: ".8rem" }}>
              {l.title}
            </div>
          )}
        </td>
        <td style={{ fontSize: ".85rem" }}>
          {l.payBasis && l.rate !== null ? (
            t(RATE_PER[l.payBasis], { amount: fmtIQD(l.rate) })
          ) : (
            <span className="badge err">{t("Pay not set")}</span>
          )}
          {l.payBasis === "monthly" && l.daysEmployed < l.daysInMonth && (
            <div className="muted">
              {t("{days} of {all} days here", {
                days: String(l.daysEmployed),
                all: String(l.daysInMonth),
              })}
            </div>
          )}
        </td>
        <td style={{ fontSize: ".85rem" }}>
          {t("{days} days, {hours}", { days: String(l.daysWorked), hours: hours(l.minutesWorked) })}
          <div className="muted">
            {l.overtimeMinutes > 0 &&
              `${t("Overtime {time}", { time: hours(l.overtimeMinutes) })} · `}
            {l.timesLate > 0 && `${t("Late {n} times", { n: String(l.timesLate) })} · `}
            {l.daysAbsent > 0 && t("Absent {n} days", { n: String(l.daysAbsent) })}
          </div>
          {l.stillIn && <span className="badge err">{t("Still clocked in")}</span>}
        </td>
        <td className="right money">{fmtIQD(l.basePay)}</td>
        <td className="right money">{l.overtimePay ? fmtIQD(l.overtimePay) : "—"}</td>
        <td className="right money">
          {l.additions ? fmtIQD(l.additions) : "—"}
          {l.additionsNote && (
            <div className="muted" style={{ fontSize: ".75rem" }}>
              {l.additionsNote}
            </div>
          )}
        </td>
        <td className="right money">
          {l.deductions ? fmtIQD(l.deductions) : "—"}
          {l.deductionsNote && (
            <div className="muted" style={{ fontSize: ".75rem" }}>
              {l.deductionsNote}
            </div>
          )}
        </td>
        <td className="right money">
          {l.advanceRecovered ? fmtIQD(l.advanceRecovered) : "—"}
          {l.advanceOwed > l.advanceRecovered && (
            <div className="muted" style={{ fontSize: ".75rem" }}>
              {t("of {owed} owed", { owed: fmtIQD(l.advanceOwed) })}
            </div>
          )}
        </td>
        <td className="right money" data-testid="line-net">
          {fmtIQD(l.net)}
        </td>
        <td className="right money">{l.paid ? fmtIQD(l.paid) : "—"}</td>
        <td>
          {canRun && run.status === "draft" && (
            <button
              type="button"
              onClick={() => setOpen(open === "adjust" ? null : "adjust")}
              data-testid="adjust-line"
            >
              {t("Adjust…")}
            </button>
          )}
          {canRun && run.status !== "draft" && owed > 0 && (
            <button
              type="button"
              onClick={() => setOpen(open === "pay" ? null : "pay")}
              data-testid="pay-line"
            >
              {t("Pay…")}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={11}>
            {open === "adjust" ? (
              <AdjustLine l={l} onDone={() => setOpen(null)} />
            ) : (
              <PayLine l={l} owed={owed} onDone={() => setOpen(null)} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function AdjustLine({ l, onDone }: { l: PayrollLine; onDone: () => void }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [add, setAdd] = useState(l.additions ? String(l.additions) : "");
  const [addNote, setAddNote] = useState(l.additionsNote ?? "");
  const [ded, setDed] = useState(l.deductions ? String(l.deductions) : "");
  const [dedNote, setDedNote] = useState(l.deductionsNote ?? "");
  const [back, setBack] = useState(l.recoverySet ? String(l.advanceRecovered) : "");
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await op.run("adjustPayrollLine", (key) =>
        adjustPayrollLineAction(
          {
            lineId: l.id,
            additions: add || "0",
            additionsNote: addNote,
            deductions: ded || "0",
            deductionsNote: dedNote,
            advanceRecovered: back || null,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="adjust-form">
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        <Field label={t("Added")}>
          <input
            style={inputStyle}
            inputMode="decimal"
            value={add}
            onChange={(e) => setAdd(e.target.value)}
          />
        </Field>
        <Field label={t("What it is for")}>
          <input
            style={inputStyle}
            value={addNote}
            placeholder={t("e.g. a bonus for Eid")}
            onChange={(e) => setAddNote(e.target.value)}
          />
        </Field>
        <Field label={t("Deducted")}>
          <input
            style={inputStyle}
            inputMode="decimal"
            value={ded}
            onChange={(e) => setDed(e.target.value)}
          />
        </Field>
        <Field label={t("What it is for")}>
          <input
            style={inputStyle}
            value={dedNote}
            placeholder={t("e.g. absent on the 12th")}
            onChange={(e) => setDedNote(e.target.value)}
          />
        </Field>
        <Field label={t("Advance taken back (empty: all owed, as far as the pay goes)")}>
          <input
            style={inputStyle}
            inputMode="decimal"
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-primary" disabled={busy} onClick={save}>
          {busy ? t("Saving…") : t("Save")}
        </button>
        <button type="button" onClick={onDone} disabled={busy}>
          {t("Cancel")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

function PayLine({ l, owed, onDone }: { l: PayrollLine; owed: number; onDone: () => void }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [amount, setAmount] = useState(String(owed));
  const [from, setFrom] = useState<StaffPaidFrom>("bank");
  const [msg, setMsg] = useState<Msg>(null);

  function pay() {
    setMsg(null);
    start(async () => {
      const r = await op.run("paySalary", (key) =>
        paySalaryAction({ lineId: l.id, amount: amount || null, paidFrom: from }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}
      data-testid="pay-form"
    >
      <Field label={t("Amount")}>
        <input
          style={inputStyle}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label={t("Paid from")}>
        <select
          style={inputStyle}
          value={from}
          onChange={(e) => setFrom(e.target.value as StaffPaidFrom)}
        >
          {STAFF_PAID_FROM.map((f) => (
            <option key={f} value={f}>
              {t(PAID_FROM_LABEL[f])}
            </option>
          ))}
        </select>
      </Field>
      <button className="btn-primary" disabled={busy} onClick={pay}>
        {busy ? t("Saving…") : t("Pay {name}", { name: l.name })}
      </button>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

/** A draft drafted again or approved; an approved payroll paid to everyone, or reopened. */
function RunActions({
  run,
  owed,
  hasPayments,
}: {
  run: PayrollDetail;
  owed: number;
  hasPayments: boolean;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [from, setFrom] = useState<StaffPaidFrom>("bank");
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function act(
    name: string,
    send: (key: string) => Promise<{ ok: true } | { ok: false; error: string }>,
    done: string,
  ) {
    setMsg(null);
    start(async () => {
      const r = await op.run(name, send);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: done });
      setReopening(false);
      router.refresh();
    });
  }

  return (
    <section className="card grid" style={{ gap: 8 }} data-testid="run-actions">
      {run.status === "draft" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn-primary"
            disabled={busy || !run.monthOver || run.current === false}
            onClick={() =>
              act(
                "approvePayroll",
                (key) => approvePayrollAction({ runId: run.id }, key),
                t("Approved, and posted."),
              )
            }
            data-testid="approve-payroll"
          >
            {t("Approve the payroll")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(
                "draftPayroll",
                (key) => draftPayrollAction({ month: run.month }, key),
                t("Drafted again."),
              )
            }
            data-testid="redraft-payroll"
          >
            {t("Draft it again")}
          </button>
        </div>
      )}
      {run.status !== "draft" && owed > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            aria-label={t("Paid from")}
            style={{ ...inputStyle, maxWidth: 260 }}
            value={from}
            onChange={(e) => setFrom(e.target.value as StaffPaidFrom)}
          >
            {STAFF_PAID_FROM.map((f) => (
              <option key={f} value={f}>
                {t(PAID_FROM_LABEL[f])}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() =>
              act(
                "payPayroll",
                (key) => payPayrollAction({ runId: run.id, paidFrom: from }, key),
                t("Paid."),
              )
            }
            data-testid="pay-everyone"
          >
            {t("Pay everyone still owed ({amount})", { amount: fmtIQD(owed) })}
          </button>
        </div>
      )}
      {run.status !== "draft" &&
        !hasPayments &&
        (reopening ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              aria-label={t("Why")}
              style={{ ...inputStyle, flex: 1, minWidth: 220 }}
              placeholder={t("e.g. Omar's start date was wrong")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={busy || !reason.trim()}
              onClick={() =>
                act(
                  "reopenPayroll",
                  (key) => reopenPayrollAction({ runId: run.id, reason }, key),
                  t("Reopened: its journal is reversed."),
                )
              }
            >
              {t("Reopen the payroll")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            style={{ alignSelf: "start" }}
            onClick={() => setReopening(true)}
            data-testid="reopen-payroll"
          >
            {t("Reopen…")}
          </button>
        ))}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </section>
  );
}

function PaymentRow({ p, canRun }: { p: PayrollDetail["payments"][number]; canRun: boolean }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const cancelled = p.cancelledAt !== null;

  function cancel() {
    setMsg(null);
    start(async () => {
      const r = await op.run("cancelSalaryPayment", (key) =>
        cancelSalaryPaymentAction({ paymentId: p.id, reason }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <tr data-testid="salary-payment" style={cancelled ? { opacity: 0.55 } : undefined}>
        <td className="mono">{p.paidOn}</td>
        <td>
          {p.people.map((x) => x.name).join(", ")}
          {cancelled && (
            <div className="badge err">{t("Cancelled: {why}", { why: p.cancelReason ?? "" })}</div>
          )}
        </td>
        <td>{t(PAID_FROM_LABEL[p.paidFrom as StaffPaidFrom] ?? p.paidFrom)}</td>
        <td className="right money">{fmtIQD(p.amount)}</td>
        <td className="mono">{p.journalNo ?? "—"}</td>
        <td>
          {canRun && !cancelled && (
            <button type="button" onClick={() => setOpen(!open)} data-testid="cancel-payment">
              {t("Cancel…")}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                aria-label={t("Why")}
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                placeholder={t("e.g. paid the wrong person")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button className="btn-primary" disabled={busy || !reason.trim()} onClick={cancel}>
                {busy ? t("Saving…") : t("Cancel the payment")}
              </button>
              <OperationStatus op={op} />
              <Notice msg={msg} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
