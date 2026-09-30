"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelAdvanceAction,
  draftPayrollAction,
  recordAdvanceAction,
} from "@/lib/actions/payroll";
import { PAID_FROM_LABEL, STAFF_PAID_FROM, type Advance, type StaffPaidFrom } from "@/lib/staff";
import type { CashOnHand } from "@/lib/cash";
import { fmtIQD } from "@/lib/format";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { CashOnHandNote } from "@/components/cash/CashOnHandNote";

type Msg = { ok: boolean; text: string } | null;

/** A month's payroll drafted (or drafted again), then opened. */
export function DraftPayroll({ months }: { months: { month: string; label: string }[] }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [month, setMonth] = useState(months[0]?.month ?? "");
  const [msg, setMsg] = useState<Msg>(null);

  function draft() {
    setMsg(null);
    start(async () => {
      const r = await op.run("draftPayroll", (key) => draftPayrollAction({ month }, key));
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.push(`/payroll/${r.data.runId}`);
    });
  }

  return (
    <div
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      data-testid="draft-payroll"
    >
      <select
        aria-label={t("The month")}
        style={{ ...inputStyle, maxWidth: 200 }}
        value={month}
        onChange={(e) => setMonth(e.target.value)}
      >
        {months.map((m) => (
          <option key={m.month} value={m.month}>
            {m.label}
          </option>
        ))}
      </select>
      <button className="btn-primary" disabled={busy || !month} onClick={draft}>
        {busy ? t("Drafting…") : t("Draft the payroll")}
      </button>
      <span className="muted" style={{ fontSize: ".8rem" }}>
        {t(
          "From the pay and the hours as they are now; drafting again keeps what was added or deducted.",
        )}
      </span>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

/**
 * Advances (0049): what each person still owes, every advance given, and a new
 * one from the till, the safe, the bank or the owner. The payroll takes them
 * back from the salary; one given by mistake is cancelled while none of it is.
 * From the safe or the till, the form says what it holds (AK).
 */
export function Advances({
  advances,
  owed,
  people,
  canRun,
  cash = null,
}: {
  advances: Advance[];
  owed: { employeeId: string; name: string; owed: number }[];
  people: { id: string; name: string }[];
  canRun: boolean;
  cash?: CashOnHand | null;
}) {
  const { t } = useT();
  const [giving, setGiving] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  return (
    <div className="grid" style={{ gap: 10 }}>
      {owed.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-testid="advances-owed">
          {owed.map((o) => (
            <span key={o.employeeId} className="badge warn">
              {t("{name} owes {amount}", { name: o.name, amount: fmtIQD(o.owed) })}
            </span>
          ))}
        </div>
      )}
      {advances.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {t("No advance has been given.")}
        </p>
      ) : (
        <div className="tw">
          <table data-testid="advances">
            <thead>
              <tr>
                <th>{t("Given")}</th>
                <th>{t("To")}</th>
                <th className="right">{t("Amount")}</th>
                <th>{t("From")}</th>
                <th>{t("What it is for")}</th>
                <th>{t("Journal")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {advances.map((a) => (
                <AdvanceRow
                  key={a.id}
                  a={a}
                  canRun={canRun}
                  cancelling={cancelling === a.id}
                  setCancelling={(on) => setCancelling(on ? a.id : null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canRun &&
        (giving ? (
          <GiveAdvance people={people} cash={cash} onDone={() => setGiving(false)} />
        ) : (
          <button
            type="button"
            style={{ alignSelf: "start" }}
            onClick={() => setGiving(true)}
            data-testid="give-advance"
          >
            {t("+ Give an advance…")}
          </button>
        ))}
    </div>
  );
}

function AdvanceRow({
  a,
  canRun,
  cancelling,
  setCancelling,
}: {
  a: Advance;
  canRun: boolean;
  cancelling: boolean;
  setCancelling: (on: boolean) => void;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const cancelled = a.cancelledAt !== null;

  function cancel() {
    setMsg(null);
    start(async () => {
      const r = await op.run("cancelAdvance", (key) =>
        cancelAdvanceAction({ advanceId: a.id, reason }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setCancelling(false);
      router.refresh();
    });
  }

  return (
    <>
      <tr
        data-testid="advance-row"
        data-name={a.name}
        style={cancelled ? { opacity: 0.55 } : undefined}
      >
        <td className="mono">{a.givenOn}</td>
        <td>{a.name}</td>
        <td className="right money">{fmtIQD(a.amount)}</td>
        <td>{t(PAID_FROM_LABEL[a.paidFrom as StaffPaidFrom] ?? a.paidFrom)}</td>
        <td>
          {a.reason}
          {cancelled && (
            <div className="badge err">{t("Cancelled: {why}", { why: a.cancelReason ?? "" })}</div>
          )}
        </td>
        <td className="mono">{a.journalNo ?? "—"}</td>
        <td>
          {canRun && !cancelled && (
            <button
              type="button"
              onClick={() => setCancelling(!cancelling)}
              data-testid="cancel-advance"
            >
              {t("Cancel…")}
            </button>
          )}
        </td>
      </tr>
      {cancelling && (
        <tr>
          <td colSpan={7}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                aria-label={t("Why")}
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                placeholder={t("e.g. given twice")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button className="btn-primary" disabled={busy || !reason.trim()} onClick={cancel}>
                {busy ? t("Saving…") : t("Cancel the advance")}
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

function GiveAdvance({
  people,
  cash,
  onDone,
}: {
  people: { id: string; name: string }[];
  cash: CashOnHand | null;
  onDone: () => void;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [who, setWho] = useState(people[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<StaffPaidFrom>("safe");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function give() {
    setMsg(null);
    start(async () => {
      const r = await op.run("recordAdvance", (key) =>
        recordAdvanceAction({ employeeId: who, amount, paidFrom: from, reason }, key),
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
    <div className="card grid" style={{ gap: 8 }} data-testid="advance-form">
      <b>{t("An advance on their pay")}</b>
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        }}
      >
        <Field label={t("To")}>
          <select style={inputStyle} value={who} onChange={(e) => setWho(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
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
        <Field label={t("What it is for")}>
          <input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <CashOnHandNote on={cash} from={from} amount={Number(normaliseNumber(amount)) || 0} />
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {t(
          "Dr 1300 Employee advances, Cr where the money came from. The next payroll takes it back from their salary.",
        )}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn-primary"
          disabled={busy || !who || !amount.trim() || !reason.trim()}
          onClick={give}
        >
          {busy ? t("Saving…") : t("Give the advance")}
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
