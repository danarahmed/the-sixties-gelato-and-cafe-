"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { postControlCorrectionAction, saveJournalAction } from "@/lib/actions/books";
import { fmtIQD } from "@/lib/format";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

export interface AccountOption {
  code: string;
  name: string;
}

interface Row {
  code: string;
  memo: string;
  debit: string;
  credit: string;
}

const emptyRow: Row = { code: "", memo: "", debit: "", credit: "" };
const amount = (v: string) => {
  const n = normaliseNumber(v);
  return /^\d+(\.\d+)?$/.test(n) ? new Decimal(n) : new Decimal(0);
};

/**
 * A journal voucher as a bookkeeper writes one: any number of lines, each to
 * an account, with the running difference shown. It cannot be published until
 * the difference is nil — the database enforces the same rule as it commits,
 * and gives the entry its number only then.
 */
export function JournalEntryForm({
  accounts,
  controlAccounts = [],
  canCorrect = false,
  nextNo,
  today,
  currency,
}: {
  accounts: AccountOption[];
  /** Stock, payables, goods received, retained earnings: the owner's corrections only. */
  controlAccounts?: AccountOption[];
  canCorrect?: boolean;
  nextNo: number | null;
  today: string;
  currency: string;
}) {
  // say: an account's name as the database has it, in the reader's language.
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [date, setDate] = useState(today);
  const [reverseOn, setReverseOn] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }, { ...emptyRow }]);
  const [correction, setCorrection] = useState(false);
  const [reason, setReason] = useState("");
  const options = correction
    ? [...accounts, ...controlAccounts].sort((a, b) => a.code.localeCompare(b.code))
    : accounts;

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s.plus(amount(r.debit)), new Decimal(0));
    const credit = rows.reduce((s, r) => s.plus(amount(r.credit)), new Decimal(0));
    return {
      debit: debit.toNumber(),
      credit: credit.toNumber(),
      difference: debit.minus(credit).toNumber(),
    };
  }, [rows]);

  const usable = rows.filter((r) => r.code && (amount(r.debit).gt(0) || amount(r.credit).gt(0)));
  const canDraft = usable.length > 0 && notes.trim().length > 0;
  const canPublish =
    canDraft &&
    usable.length >= 2 &&
    totals.difference === 0 &&
    totals.debit > 0 &&
    (!correction || reason.trim().length > 0);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function reset() {
    setRows([{ ...emptyRow }, { ...emptyRow }]);
    setNotes("");
    setReferenceNo("");
    setReverseOn("");
    setDate(today);
    setReason("");
    setCorrection(false);
  }

  function save(publish: boolean) {
    setMsg(null);
    if (correction) {
      start(async () => {
        const r = await postControlCorrectionAction({
          date,
          description: notes,
          reason,
          lines: usable.map((l) => ({
            code: l.code,
            memo: l.memo,
            debit: l.debit || "0",
            credit: l.credit || "0",
          })),
        });
        if (r.ok) {
          setMsg({
            ok: true,
            text: t("Correction published as journal {no}; the reason is on the audit trail.", {
              no: String(r.data.journalNo),
            }),
          });
          reset();
          router.refresh();
        } else setMsg({ ok: false, text: r.error });
      });
      return;
    }
    start(async () => {
      const r = await saveJournalAction({
        date,
        description: notes,
        referenceNo,
        reverseOn: reverseOn || null,
        publish,
        lines: usable.map((l) => ({
          code: l.code,
          memo: l.memo,
          debit: l.debit || "0",
          credit: l.credit || "0",
        })),
      });
      if (r.ok) {
        setMsg({
          ok: true,
          text: publish
            ? r.data.reversalNo
              ? t("Journal {no} published; its reversal is journal {reversal}.", {
                  no: String(r.data.journalNo),
                  reversal: r.data.reversalNo,
                })
              : t("Journal {no} published.", { no: String(r.data.journalNo) })
            : t("Saved as a draft. It is not in the books until it is published."),
        });
        reset();
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (!open) {
    return (
      <div
        className="panel-b"
        style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
      >
        <button className="btn-primary" onClick={() => setOpen(true)}>
          {t("New Journal")}
        </button>
        <span className="muted" style={{ fontSize: ".78rem" }}>
          {t(
            "For anything that is not a sale, a receipt, a bill, a payment or an expense. Stock, payables, goods-received and retained earnings are kept by their own records and take no manual journal.",
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="panel-b">
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}
      >
        <label>
          <div className="sc">{t("Date")} *</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {!correction && (
          <label>
            <div className="sc">{t("Reverse on (optional)")}</div>
            <input
              type="date"
              value={reverseOn}
              min={date}
              onChange={(e) => setReverseOn(e.target.value)}
            />
          </label>
        )}
        <label>
          <div className="sc">{t("Journal #")}</div>
          <input
            value={nextNo ? t("{n} (given on publish)", { n: nextNo }) : t("Given on publish")}
            readOnly
            style={{ color: "var(--faint)" }}
          />
        </label>
        <label>
          <div className="sc">{t("Reference #")}</div>
          <input
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            maxLength={60}
          />
        </label>
        <label>
          <div className="sc">{t("Currency")}</div>
          <input value={currency} readOnly style={{ color: "var(--faint)" }} />
        </label>
      </div>

      {canCorrect && (
        <label
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            marginBlockStart: 12,
            fontSize: ".85rem",
          }}
        >
          <input
            type="checkbox"
            checked={correction}
            onChange={(e) => {
              setCorrection(e.target.checked);
              setReverseOn("");
            }}
          />
          {t(
            "Correction to a control account (the till's cash, Inventory, payables, goods received, retained earnings) — owner only, with a reason on the audit trail. For repairing history recorded before the controls; see docs/REMEDIATION.md.",
          )}
        </label>
      )}
      {correction && (
        <label style={{ display: "block", marginBlockStart: 8 }}>
          <div className="sc">{t("Reason for the correction")} *</div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("What was wrong, and how this entry puts it right")}
            maxLength={500}
          />
        </label>
      )}

      <label style={{ display: "block", marginBlockStart: 12 }}>
        <div className="sc">{t("Notes")} *</div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("Being the reason this entry is made")}
          maxLength={500}
        />
      </label>

      {reverseOn && (
        <p className="muted" style={{ fontSize: ".76rem", marginBlockEnd: 0 }}>
          {t(
            "On publishing, a mirror entry dated {date} is posted too, reversing every line below.",
            { date: reverseOn },
          )}
        </p>
      )}

      <div className="tw" style={{ marginBlockStart: 16 }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 190 }}>{t("Account")}</th>
              <th style={{ minWidth: 180 }}>{t("Description")}</th>
              <th className="right" style={{ width: 130 }}>
                {t("Debits")}
              </th>
              <th className="right" style={{ width: 130 }}>
                {t("Credits")}
              </th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <select value={r.code} onChange={(e) => setRow(i, { code: e.target.value })}>
                    <option value="">{t("Select an account")}</option>
                    {options.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} {say(a.name)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={r.memo}
                    onChange={(e) => setRow(i, { memo: e.target.value })}
                    placeholder={t("Description")}
                    maxLength={200}
                  />
                </td>
                <td>
                  <input
                    className="amt"
                    style={{ textAlign: "end" }}
                    inputMode="decimal"
                    value={r.debit}
                    onChange={(e) => setRow(i, { debit: e.target.value, credit: "" })}
                  />
                </td>
                <td>
                  <input
                    className="amt"
                    style={{ textAlign: "end" }}
                    inputMode="decimal"
                    value={r.credit}
                    onChange={(e) => setRow(i, { credit: e.target.value, debit: "" })}
                  />
                </td>
                <td className="right">
                  <button
                    onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                    disabled={rows.length <= 2}
                    title={t("Remove line")}
                    style={{ minHeight: 28, padding: "0 8px" }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginBlockStart: 12,
        }}
      >
        <button onClick={() => setRows((rs) => [...rs, { ...emptyRow }])}>{t("+ Add line")}</button>
        <div className="voucher" style={{ minWidth: 300, flex: 1, maxWidth: 420 }}>
          <div className="st-row total">
            <span className="lbl">
              {t("Total")} ({currency})
            </span>
            <span className="amt">
              {/* i18n-ignore: the spaces around the slash, not words */}
              {fmtIQD(totals.debit)} &nbsp;/&nbsp; {fmtIQD(totals.credit)}
            </span>
          </div>
          <div className="st-row">
            <span
              className="lbl"
              style={{ color: totals.difference === 0 ? "var(--ok)" : "var(--err)" }}
            >
              {t("Difference")}
            </span>
            <span className={`amt ${totals.difference === 0 ? "" : "red"}`}>
              {fmtIQD(Math.abs(totals.difference))}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBlockStart: 16,
          flexWrap: "wrap",
        }}
      >
        <button className="btn-primary" onClick={() => save(true)} disabled={busy || !canPublish}>
          {busy ? t("Saving…") : t("Save and publish")}
        </button>
        <button onClick={() => save(false)} disabled={busy || !canDraft || correction}>
          {t("Save as draft")}
        </button>
        <button
          onClick={() => {
            reset();
            setOpen(false);
            setMsg(null);
          }}
          disabled={busy}
        >
          {t("Cancel")}
        </button>
        {!canPublish && usable.length > 0 && totals.difference !== 0 && (
          <span className="muted" style={{ fontSize: ".76rem" }}>
            {t("Debits and credits must agree before it can be published.")}
          </span>
        )}
        <Notice msg={msg} />
      </div>
    </div>
  );
}
