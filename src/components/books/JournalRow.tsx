"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishJournalAction, discardDraftAction } from "@/lib/db/books-actions";
import { fmtIQD } from "@/lib/format";

export interface RegisterEntry {
  id: string;
  journalNo: number | null;
  date: string;
  referenceNo: string | null;
  notes: string;
  status: string;
  amount: number;
  createdBy: string;
  lines: { account: string; description: string | null; debit: number; credit: number }[];
}

/** One row of the register; expands to show the lines as they were written. */
export function JournalRow({ entry, locked }: { entry: RegisterEntry; locked: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isDraft = entry.status === "draft";

  const debit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const credit = entry.lines.reduce((s, l) => s + l.credit, 0);
  const difference = Math.round(debit - credit);

  function publish() {
    setErr(null);
    start(async () => {
      const r = await publishJournalAction(entry.id);
      if (r.ok) router.refresh();
      else setErr(r.error ?? "Could not publish");
    });
  }
  function discard() {
    setErr(null);
    start(async () => {
      const r = await discardDraftAction(entry.id);
      if (r.ok) router.refresh();
      else setErr(r.error ?? "Could not discard");
    });
  }

  return (
    <>
      <tr>
        <td>{entry.date}</td>
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
            {entry.journalNo ?? "—"}
          </button>
        </td>
        <td className="faint">{entry.referenceNo ?? "—"}</td>
        <td>
          <span className={`ref ${isDraft ? "due" : "auto"}`}>{isDraft ? "Draft" : "Published"}</span>
        </td>
        <td>{entry.notes}</td>
        <td className="right money">{fmtIQD(entry.amount)}</td>
        <td className="faint">{entry.createdBy}</td>
        <td className="right">
          {isDraft && !locked && (
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                onClick={publish}
                disabled={busy || difference !== 0}
                title={difference === 0 ? "Publish to the books" : "Does not balance"}
                style={{ minHeight: 26, padding: "0 8px", fontSize: ".72rem" }}
              >
                Publish
              </button>
              <button
                onClick={discard}
                disabled={busy}
                style={{ minHeight: 26, padding: "0 8px", fontSize: ".72rem" }}
              >
                Discard
              </button>
            </span>
          )}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={8} style={{ background: "var(--surface)" }}>
            <div className="voucher" style={{ maxWidth: 620, margin: "6px 0" }}>
              <div className="sc" style={{ borderBlockEnd: "1px solid var(--rule)", paddingBlockEnd: 6, marginBlockEnd: 8 }}>
                Journal {entry.journalNo ?? ""} · {entry.date}
                {entry.referenceNo ? ` · ref ${entry.referenceNo}` : ""}
              </div>
              {entry.lines.map((l, i) => (
                <div key={i} className={`vline ${l.credit > 0 ? "credit" : ""}`}>
                  <span className="dr">{l.debit > 0 ? "Dr" : "Cr"}</span>
                  <span className="acct">
                    {l.account}
                    {l.description && <em style={{ marginInlineStart: 8 }}>{l.description}</em>}
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
            {err && (
              <p className="red" style={{ fontSize: ".78rem", margin: "0 0 8px" }}>
                {err}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
