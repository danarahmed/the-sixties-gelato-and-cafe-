"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveCountAction,
  cancelCountAction,
  recordCountAction,
  rejectCountAction,
  startCountAction,
  submitCountAction,
} from "@/lib/actions/stock";
import { fmtIQD } from "@/lib/format";
import { Notice, inputStyle } from "@/components/ui";

type Msg = { ok: boolean; text: string } | null;

export function StartCount() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <div
      className="card"
      style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <strong>Start a full count</strong>
        <div className="muted" style={{ fontSize: ".85rem" }}>
          Every active item is listed. Count them in any order; your entries are saved as you go.
        </div>
      </div>
      <button
        className="btn-primary"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await startCountAction();
            if (r.ok) router.refresh();
            else setMsg({ ok: false, text: r.error });
          })
        }
      >
        {busy ? "Opening…" : "Start count"}
      </button>
      <Notice msg={msg} />
    </div>
  );
}

interface SheetLine {
  itemId: string;
  name: string;
  unit: string;
  counted: number | null;
}

/** The counter's sheet: names and their own entries — never what the ledger expects. */
export function CountSheet({ countId, lines }: { countId: string; lines: SheetLine[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.itemId, l.counted === null ? "" : String(l.counted)])),
  );
  const [saved, setSaved] = useState<Record<string, boolean>>(
    Object.fromEntries(lines.map((l) => [l.itemId, l.counted !== null])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const done = Object.values(saved).filter(Boolean).length;

  async function save(itemId: string) {
    const v = values[itemId] ?? "";
    if (v.trim() === "") return;
    const r = await recordCountAction({ countId, itemId, counted: v });
    if (r.ok) {
      setSaved((s) => ({ ...s, [itemId]: true }));
      setErrors((e) => ({ ...e, [itemId]: "" }));
    } else {
      setSaved((s) => ({ ...s, [itemId]: false }));
      setErrors((e) => ({ ...e, [itemId]: r.error }));
    }
  }

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await submitCountAction({ countId });
      if (r.ok) {
        setMsg({ ok: true, text: "Count submitted for a manager to review." });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="card tw">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0 }}>Your count</h3>
        <span className="muted" style={{ fontSize: ".85rem" }}>
          {done} of {lines.length} counted
        </span>
      </div>
      <table style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Item</th>
            <th className="right">Counted</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.itemId}>
              <td>
                {l.name} <span className="muted">({l.unit})</span>
                {errors[l.itemId] && (
                  <div className="red" style={{ fontSize: ".75rem" }}>
                    {errors[l.itemId]}
                  </div>
                )}
              </td>
              <td className="right">
                <input
                  style={{ ...inputStyle, width: 130, textAlign: "right" }}
                  value={values[l.itemId] ?? ""}
                  onChange={(e) => {
                    setValues({ ...values, [l.itemId]: e.target.value });
                    setSaved((s) => ({ ...s, [l.itemId]: false }));
                  }}
                  onBlur={() => void save(l.itemId)}
                  inputMode="decimal"
                  placeholder="—"
                  aria-label={`Counted ${l.name}`}
                />
              </td>
              <td style={{ width: 30 }}>{saved[l.itemId] ? "✓" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}
      >
        <button className="btn-primary" onClick={submit} disabled={busy || done < lines.length}>
          {busy ? "Submitting…" : "Submit count"}
        </button>
        {done < lines.length && (
          <span className="muted" style={{ fontSize: ".8rem" }}>
            Count every item before submitting — enter 0 for anything not there.
          </span>
        )}
        <Notice msg={msg} />
      </div>
    </div>
  );
}

/** Approve or reject a submitted count — by someone other than the counter. */
export function ReviewActions({ countId, countedByMe }: { countId: string; countedByMe: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  if (countedByMe) {
    return (
      <p className="muted" style={{ fontSize: ".85rem" }}>
        You counted this one, so someone else must approve it.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        className="btn-primary"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await approveCountAction({ countId });
            if (r.ok) {
              setMsg({
                ok: true,
                text: `Approved — loss ${fmtIQD(r.data.loss)}, gain ${fmtIQD(r.data.gain)}${r.data.journalNo ? ` (journal ${r.data.journalNo})` : ""}.`,
              });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        Approve and post variances
      </button>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason to reject (recount)"
        style={{ minHeight: 36, minWidth: 200 }}
        maxLength={300}
      />
      <button
        disabled={busy || !reason.trim()}
        onClick={() =>
          start(async () => {
            const r = await rejectCountAction({ countId, reason });
            if (r.ok) {
              setMsg({ ok: true, text: "Rejected — nothing was posted." });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        Reject
      </button>
      <Notice msg={msg} />
    </div>
  );
}

/** An open count cancelled, with the reason, by its counter or a manager. Nothing was posted. */
export function CancelCount({ countId, label }: { countId: string; label: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label={`Cancel ${label}`}>
        Cancel this count…
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        aria-label="Why the count is cancelled"
        style={{ ...inputStyle, minWidth: 220 }}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why? e.g. started by mistake"
      />
      <button
        className="btn-primary"
        disabled={busy || !reason.trim()}
        onClick={() =>
          start(async () => {
            const r = await cancelCountAction({ countId, reason });
            if (r.ok) {
              setOpen(false);
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        {busy ? "…" : "Cancel the count"}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy}>
        Keep it
      </button>
      <Notice msg={msg} />
    </div>
  );
}
