"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  discardJournalAction,
  publishJournalAction,
  reverseJournalAction,
} from "@/lib/actions/books";
import { fmtIQD } from "@/lib/format";
import { dateIn } from "@/lib/dates";
import type { JournalRegisterRow } from "@/lib/db/books";
import { useT } from "@/lib/i18n/I18nProvider";

/** Where a journal came from, in words: phrases, shown through t(). */
const SOURCE: Record<string, string> = {
  sales_order: "Sale",
  sale_refund: "Refund",
  reversal: "Reversal",
  goods_receipt: "Receipt",
  purchase_invoice: "Bill",
  supplier_payment: "Payment",
  expense: "Expense",
  inventory_movement: "Stock",
  stock_count: "Count",
  work_shift: "Drawer count",
  cash_transfer: "Cash moved",
  manual: "Manual",
  correction: "Correction",
  card_settlement: "Card settlement",
  platform_settlement: "Platform settlement",
  year_end_close: "Year end",
};

/** One entry of the register; expands to show its lines as they were written. */
export function JournalRow({
  entry,
  timezone,
  canPost,
  today,
}: {
  entry: JournalRegisterRow;
  timezone: string;
  canPost: boolean;
  today: string;
}) {
  const { t, msg } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");
  const [revDate, setRevDate] = useState(today);
  const [err, setErr] = useState<string | null>(null);
  const isDraft = entry.status === "draft";
  const entryDay = dateIn(timezone, new Date(entry.occurredAt));
  const debit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const credit = entry.lines.reduce((s, l) => s + l.credit, 0);
  const difference = Math.round(debit - credit);
  const canReverse = canPost && !isDraft && entry.reversedByNo === null && entry.reversibleByHand;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setReversing(false);
        setReason("");
        router.refresh();
      } else setErr(r.error);
    });
  }

  const small = { minHeight: 26, padding: "0 8px", fontSize: ".72rem" };

  return (
    <>
      <tr>
        <td>{dateIn(timezone, new Date(entry.occurredAt))}</td>
        <td>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              minHeight: 0,
              color: "var(--brand)",
              fontWeight: 600,
            }}
          >
            {entry.journalNo ?? t("draft")}
          </button>
        </td>
        <td className="faint">
          {t(SOURCE[entry.referenceType ?? ""] ?? entry.referenceType ?? "—")}
          {entry.referenceNo ? ` · ${entry.referenceNo}` : ""}
        </td>
        <td>
          <span className={`ref ${isDraft ? "due" : "auto"}`}>
            {isDraft ? t("Draft") : t("Published")}
          </span>
          {entry.legacy && (
            <span
              className="ref"
              title={t(
                "Recorded before the ledger controls; kept as it was and reported for review",
              )}
            >
              {" "}
              {t("before controls")}
            </span>
          )}
        </td>
        <td>
          {msg(entry.notes)}
          {entry.reversesNo !== null && (
            <span className="muted"> · {t("reverses #{no}", { no: entry.reversesNo })}</span>
          )}
          {entry.reversedByNo !== null && (
            <span className="muted"> · {t("reversed by #{no}", { no: entry.reversedByNo })}</span>
          )}
        </td>
        <td className="right money">{fmtIQD(entry.amount)}</td>
        <td className="faint">{entry.createdBy}</td>
        <td className="right">
          {canPost && isDraft && (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                onClick={() => run(() => publishJournalAction({ entryId: entry.id }))}
                disabled={busy || difference !== 0}
                title={difference === 0 ? t("Publish to the books") : t("Does not balance")}
                style={small}
              >
                {t("Publish")}
              </button>
              <button
                onClick={() => run(() => discardJournalAction({ entryId: entry.id }))}
                disabled={busy}
                style={small}
              >
                {t("Discard")}
              </button>
            </span>
          )}
          {canReverse && !reversing && (
            <button onClick={() => setReversing(true)} style={small}>
              {t("Reverse")}
            </button>
          )}
        </td>
      </tr>

      {reversing && (
        <tr>
          <td colSpan={8} style={{ background: "var(--surface)" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
                padding: "6px 0",
              }}
            >
              <span className="muted" style={{ fontSize: ".8rem" }}>
                {t("Reverse journal {no} with a mirror entry dated", {
                  no: entry.journalNo ?? "",
                })}
              </span>
              <input
                type="date"
                value={revDate}
                min={entryDay}
                max={today}
                onChange={(e) => setRevDate(e.target.value)}
                aria-label={t("Date of the reversal")}
                style={{ minHeight: 30 }}
              />
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("Why is it being reversed?")}
                style={{ minHeight: 30, minWidth: 260 }}
                maxLength={300}
                autoFocus
              />
              <button
                className="btn-primary"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  run(() => reverseJournalAction({ entryId: entry.id, reason, date: revDate }))
                }
                style={small}
              >
                {busy ? "…" : t("Post reversal")}
              </button>
              <button onClick={() => setReversing(false)} disabled={busy} style={small}>
                {t("Cancel")}
              </button>
              {err && (
                <span className="red" style={{ fontSize: ".78rem" }}>
                  {msg(err)}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}

      {open && (
        <tr>
          <td colSpan={8} style={{ background: "var(--surface)" }}>
            <div className="voucher" style={{ maxWidth: 640, margin: "6px 0" }}>
              <div
                className="sc"
                style={{
                  borderBlockEnd: "1px solid var(--rule)",
                  paddingBlockEnd: 6,
                  marginBlockEnd: 8,
                }}
              >
                {t("Journal {no}", { no: entry.journalNo ?? t("(draft)") })} ·{" "}
                {dateIn(timezone, new Date(entry.occurredAt))}
                {entry.referenceNo ? ` · ${t("ref {ref}", { ref: entry.referenceNo })}` : ""}
              </div>
              {entry.lines.map((l, i) => (
                <div key={i} className={`vline ${l.credit > 0 ? "credit" : ""}`}>
                  <span className="dr">{l.debit > 0 ? t("Dr") : t("Cr")}</span>
                  <span className="acct">
                    {msg(l.account)}
                    {l.memo && <em style={{ marginInlineStart: 8 }}>{l.memo}</em>}
                  </span>
                  <span className="amt">{fmtIQD(l.debit > 0 ? l.debit : l.credit)}</span>
                </div>
              ))}
              <div className="vfoot">
                <span>{t("Being {text}", { text: msg(entry.notes).toLowerCase() })}</span>
                <span className={difference === 0 ? "" : "red"}>
                  {difference === 0
                    ? t("Balanced — {amount} both sides", { amount: fmtIQD(debit) })
                    : t("Out by {amount}", { amount: fmtIQD(Math.abs(difference)) })}
                </span>
              </div>
            </div>
            {err && !reversing && (
              <p className="red" style={{ fontSize: ".78rem", margin: "0 0 8px" }}>
                {msg(err)}
              </p>
            )}
          </td>
        </tr>
      )}
      {!open && err && !reversing && (
        <tr>
          <td colSpan={8} className="red" style={{ fontSize: ".78rem" }}>
            {msg(err)}
          </td>
        </tr>
      )}
    </>
  );
}
