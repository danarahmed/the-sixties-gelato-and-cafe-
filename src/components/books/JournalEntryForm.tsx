"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveJournalAction } from "@/lib/db/books-actions";
import { fmtIQD } from "@/lib/format";
import { Notice } from "@/components/ui";

export interface AccountOption {
  code: string;
  name: string;
}
export interface PersonOption {
  id: string;
  name: string;
}

interface Row {
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
}

const emptyRow: Row = { accountCode: "", description: "", debit: "", credit: "" };
const num = (v: string) => Number((v || "").replace(/[^0-9.]/g, "")) || 0;

/**
 * A journal voucher as a bookkeeper writes one: any number of lines, each to an
 * account, with the running difference shown. It cannot be published until the
 * difference is nil — the database enforces the same rule at commit.
 */
export function JournalEntryForm({
  accounts,
  people,
  nextNo,
  currency,
}: {
  accounts: AccountOption[];
  people: PersonOption[];
  nextNo: number;
  currency: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [reverseOn, setReverseOn] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [postedBy, setPostedBy] = useState(people[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }, { ...emptyRow }]);

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + num(r.debit), 0);
    const credit = rows.reduce((s, r) => s + num(r.credit), 0);
    return { debit, credit, difference: Math.round(debit - credit) };
  }, [rows]);

  const usable = rows.filter((r) => r.accountCode && (num(r.debit) > 0 || num(r.credit) > 0));
  const canPublish = usable.length > 0 && totals.difference === 0 && notes.trim().length > 0;
  const canDraft = usable.length > 0 && notes.trim().length > 0;

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function reset() {
    setRows([{ ...emptyRow }, { ...emptyRow }]);
    setNotes("");
    setReferenceNo("");
    setReverseOn("");
    setDate(today);
  }

  function save(publish: boolean) {
    setMsg(null);
    start(async () => {
      const r = await saveJournalAction({
        date,
        referenceNo,
        notes,
        postedBy: postedBy || null,
        reverseOn: reverseOn || null,
        publish,
        lines: usable.map((l) => ({
          accountCode: l.accountCode,
          description: l.description,
          debit: num(l.debit),
          credit: num(l.credit),
        })),
      });
      if (r.ok) {
        setMsg({
          ok: true,
          text: publish
            ? `Journal ${r.journalNo} published.`
            : `Journal ${r.journalNo} saved as a draft.`,
        });
        reset();
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  if (!open) {
    return (
      <div className="panel-b" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          New Journal
        </button>
        <span className="muted" style={{ fontSize: ".78rem" }}>
          Next number will be {nextNo}. Anything unusual that is not a sale, a bill or an expense
          belongs here.
        </span>
      </div>
    );
  }

  return (
    <div className="panel-b">
      {/* ---------- header fields ---------- */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <label>
          <div className="sc">Date *</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          <div className="sc">Reverse journal date</div>
          <input type="date" value={reverseOn} onChange={(e) => setReverseOn(e.target.value)} />
        </label>
        <label>
          <div className="sc">Journal #</div>
          <input value={nextNo} readOnly style={{ color: "var(--faint)" }} />
        </label>
        <label>
          <div className="sc">Reference #</div>
          <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </label>
        <label>
          <div className="sc">Created by</div>
          <select value={postedBy} onChange={(e) => setPostedBy(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="sc">Currency</div>
          <input value={currency} readOnly style={{ color: "var(--faint)" }} />
        </label>
      </div>

      <label style={{ display: "block", marginBlockStart: 12 }}>
        <div className="sc">Notes *</div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Being the reason this entry is made"
          maxLength={500}
        />
      </label>

      {reverseOn && (
        <p className="muted" style={{ fontSize: ".76rem", marginBlockEnd: 0 }}>
          A mirror entry will be posted on {reverseOn}, reversing every line below.
        </p>
      )}

      {/* ---------- line grid ---------- */}
      <div className="tw" style={{ marginBlockStart: 16 }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 190 }}>Account</th>
              <th style={{ minWidth: 180 }}>Description</th>
              <th className="right" style={{ width: 130 }}>
                Debits
              </th>
              <th className="right" style={{ width: 130 }}>
                Credits
              </th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <select
                    value={r.accountCode}
                    onChange={(e) => setRow(i, { accountCode: e.target.value })}
                  >
                    <option value="">Select an account</option>
                    {accounts.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={r.description}
                    onChange={(e) => setRow(i, { description: e.target.value })}
                    placeholder="Description"
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
                    title="Remove line"
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

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start", marginBlockStart: 12 }}>
        <button onClick={() => setRows((rs) => [...rs, { ...emptyRow }])}>+ Add new row</button>

        <div className="voucher" style={{ minWidth: 300, flex: 1, maxWidth: 420 }}>
          <div className="st-row">
            <span className="lbl">Sub total</span>
            <span className="amt">
              {fmtIQD(totals.debit)} &nbsp;/&nbsp; {fmtIQD(totals.credit)}
            </span>
          </div>
          <div className="rule-single" />
          <div className="st-row total">
            <span className="lbl">Total ({currency})</span>
            <span className="amt">
              {fmtIQD(totals.debit)} &nbsp;/&nbsp; {fmtIQD(totals.credit)}
            </span>
          </div>
          <div className="st-row">
            <span className="lbl" style={{ color: totals.difference === 0 ? "var(--ok)" : "var(--err)" }}>
              Difference
            </span>
            <span className={`amt ${totals.difference === 0 ? "" : "red"}`}>
              {fmtIQD(Math.abs(totals.difference))}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBlockStart: 16, flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={() => save(true)} disabled={busy || !canPublish}>
          {busy ? "Saving…" : "Save and publish"}
        </button>
        <button onClick={() => save(false)} disabled={busy || !canDraft}>
          Save as draft
        </button>
        <button
          onClick={() => {
            reset();
            setOpen(false);
            setMsg(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
        {!canPublish && usable.length > 0 && totals.difference !== 0 && (
          <span className="muted" style={{ fontSize: ".76rem" }}>
            Debits and credits must agree before it can be published.
          </span>
        )}
        <Notice msg={msg} />
      </div>
    </div>
  );
}
