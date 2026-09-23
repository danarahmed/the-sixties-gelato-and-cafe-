"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockPeriodAction, unlockPeriodAction } from "@/lib/actions/books";
import { dateTimeIn } from "@/lib/dates";
import { Notice } from "@/components/ui";
import type { CheckRow } from "@/lib/db/books";

/**
 * Closing a period. Every check must pass before the lock is offered, and the
 * database runs them all again as it locks, so the lock cannot be forced past
 * an open day, an unapproved count, a draft or a subledger that disagrees
 * with its control account (audit H-08). Reopening is the owner's alone, with
 * a reason on the audit trail.
 */
export function PeriodControl({
  period,
  checklist,
  canLock,
  canUnlock,
  timezone,
}: {
  period: {
    id: string;
    name: string;
    status: string;
    lockedAt: string | null;
    lockedBy: string | null;
  };
  checklist: CheckRow[];
  canLock: boolean;
  canUnlock: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = period.status === "locked";
  const failing = checklist.filter((c) => !c.ok);

  function lock() {
    setMsg(null);
    start(async () => {
      const r = await lockPeriodAction({ periodId: period.id, reason });
      if (r.ok) {
        setMsg({
          ok: true,
          text:
            `${r.data.period} is locked. Corrections now go in by reversing entries in an open period.` +
            (r.data.yearEndJournalNo
              ? ` The year-end close was posted as journal ${r.data.yearEndJournalNo}.`
              : ""),
        });
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }
  function unlock() {
    setMsg(null);
    start(async () => {
      const r = await unlockPeriodAction({ periodId: period.id, reason });
      if (r.ok) {
        setMsg({
          ok: true,
          text: `${period.name} is open again. The reason is on the audit trail.`,
        });
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <section className="panel">
      <div className="panel-h">
        <h3>Close {period.name}</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          {locked
            ? `Locked${period.lockedAt ? ` ${dateTimeIn(timezone, period.lockedAt)}` : ""}${period.lockedBy ? ` by ${period.lockedBy}` : ""}`
            : "Every check must pass before the period can be locked"}
        </span>
      </div>
      <div className="panel-b" style={{ display: "grid", gap: 14 }}>
        {!locked && (
          <table>
            <tbody>
              {checklist.map((c) => (
                <tr key={c.key}>
                  <td style={{ width: 28 }}>{c.ok ? "✅" : "⛔"}</td>
                  <td>{c.label}</td>
                  <td className={c.ok ? "muted" : "red"} style={{ fontSize: ".82rem" }}>
                    {c.detail ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!locked && canLock && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Note for the audit trail (optional)"
              style={{ minHeight: 36, minWidth: 260 }}
              maxLength={300}
            />
            <button className="btn-primary" onClick={lock} disabled={busy || failing.length > 0}>
              {busy ? "Locking…" : `Lock ${period.name}`}
            </button>
            {failing.length > 0 && (
              <span className="muted" style={{ fontSize: ".78rem" }}>
                Resolve the {failing.length} failing check(s) first.
              </span>
            )}
          </div>
        )}

        {locked && canUnlock && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why must it be reopened? (required)"
              style={{ minHeight: 36, minWidth: 300 }}
              maxLength={300}
            />
            <button onClick={unlock} disabled={busy || !reason.trim()}>
              {busy ? "Reopening…" : `Reopen ${period.name}`}
            </button>
          </div>
        )}
        {locked && !canUnlock && (
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            Only the owner can reopen a locked period.
          </p>
        )}
        <Notice msg={msg} />
      </div>
    </section>
  );
}
