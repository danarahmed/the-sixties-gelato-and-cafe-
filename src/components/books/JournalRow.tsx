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
            {entry.journalNo ?? "draft"}
          </button>
        </td>
        <td className="faint">
          {SOURCE[entry.referenceType ?? ""] ?? entry.referenceType ?? "—"}
          {entry.referenceNo ? ` · ${entry.referenceNo}` : ""}
        </td>
        <td>
          <span className={`ref ${isDraft ? "due" : "auto"}`}>
            {isDraft ? "Draft" : "Published"}
          </span>
          {entry.legacy && (
            <span
              className="ref"
              title="Recorded before the ledger controls; kept as it was and reported for review"
            >
              {" "}
              before controls
            </span>
          )}
        </td>
        <td>
          {entry.notes}
          {entry.reversesNo !== null && (
            <span className="muted"> · reverses #{entry.reversesNo}</span>
          )}
          {entry.reversedByNo !== null && (
            <span className="muted"> · reversed by #{entry.reversedByNo}</span>
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
                title={difference === 0 ? "Publish to the books" : "Does not balance"}
                style={small}
              >
                Publish
              </button>
              <button
                onClick={() => run(() => discardJournalAction({ entryId: entry.id }))}
                disabled={busy}
                style={small}
              >
                Discard
              </button>
            </span>
          )}
          {canReverse && !reversing && (
            <button onClick={() => setReversing(true)} style={small}>
              Reverse
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
                Reverse journal {entry.journalNo} with a mirror entry dated
              </span>
              <input
                type="date"
                value={revDate}
                min={entryDay}
                max={today}
                onChange={(e) => setRevDate(e.target.value)}
                aria-label="Date of the reversal"
                style={{ minHeight: 30 }}
              />
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is it being reversed?"
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
                {busy ? "…" : "Post reversal"}
              </button>
              <button onClick={() => setReversing(false)} disabled={busy} style={small}>
                Cancel
              </button>
              {err && (
                <span className="red" style={{ fontSize: ".78rem" }}>
                  {err}
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
                Journal {entry.journalNo ?? "(draft)"} ·{" "}
                {dateIn(timezone, new Date(entry.occurredAt))}
                {entry.referenceNo ? ` · ref ${entry.referenceNo}` : ""}
              </div>
              {entry.lines.map((l, i) => (
                <div key={i} className={`vline ${l.credit > 0 ? "credit" : ""}`}>
                  <span className="dr">{l.debit > 0 ? "Dr" : "Cr"}</span>
                  <span className="acct">
                    {l.account}
                    {l.memo && <em style={{ marginInlineStart: 8 }}>{l.memo}</em>}
                  </span>
                  <span className="amt">{fmtIQD(l.debit > 0 ? l.debit : l.credit)}</span>
                </div>
              ))}
              <div className="vfoot">
                <span>Being {entry.notes.toLowerCase()}</span>
                <span className={difference === 0 ? "" : "red"}>
                  {difference === 0
                    ? `Balanced — ${fmtIQD(debit)} both sides`
                    : `Out by ${fmtIQD(Math.abs(difference))}`}
                </span>
              </div>
            </div>
            {err && !reversing && (
              <p className="red" style={{ fontSize: ".78rem", margin: "0 0 8px" }}>
                {err}
              </p>
            )}
          </td>
        </tr>
      )}
      {!open && err && !reversing && (
        <tr>
          <td colSpan={8} className="red" style={{ fontSize: ".78rem" }}>
            {err}
          </td>
        </tr>
      )}
    </>
  );
}
