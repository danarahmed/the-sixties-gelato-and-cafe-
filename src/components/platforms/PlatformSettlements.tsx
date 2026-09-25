"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelPlatformSettlementAction } from "@/lib/actions/settlements";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { Notice } from "@/components/ui";
import type { PlatformSettlement } from "@/lib/settlements";

/**
 * The statements posted, newest first (0030). One posted by mistake is
 * cancelled with a reason: its journal is reversed and its orders wait again.
 */
export function PlatformSettlements({
  settlements,
  names,
  canCancel,
  timezone,
}: {
  settlements: PlatformSettlement[];
  names: Record<string, string>;
  canCancel: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function cancel(id: string) {
    setMsg(null);
    start(async () => {
      const r = await cancelPlatformSettlementAction({ id, reason });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: "Cancelled: its journal is reversed, and its orders wait again." });
      setCancelling(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="panel-b">
      <Notice msg={msg} />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Statement</th>
              <th>Arrived</th>
              <th className="right">Orders paid</th>
              <th className="right">Paid for them</th>
              <th>Journal</th>
              <th>By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr
                key={s.id}
                data-testid="platform-settlement"
                style={s.cancelledAt ? { opacity: 0.6 } : undefined}
              >
                <td>
                  <strong>{names[s.platform] ?? s.platform}</strong>{" "}
                  <span className="mono">{s.reference}</span>
                  {s.periodStart && (
                    <div className="muted" style={{ fontSize: ".78rem" }}>
                      orders of{" "}
                      {s.periodStart === s.periodEnd
                        ? s.periodStart
                        : `${s.periodStart} – ${s.periodEnd}`}
                    </div>
                  )}
                  {s.note && (
                    <div className="muted" style={{ fontSize: ".78rem" }}>
                      {s.note}
                    </div>
                  )}
                </td>
                <td className="mono" style={{ fontSize: ".8rem" }}>
                  {s.receivedOn ?? "—"}
                </td>
                <td className="right money">
                  {s.orders}
                  {s.lines > s.orders && <span className="muted"> of {s.lines} lines</span>}
                </td>
                <td className="right money">{fmtIQD(s.payout)}</td>
                <td className="mono">{s.journalNo ?? "—"}</td>
                <td className="muted" style={{ fontSize: ".8rem" }}>
                  {s.by ?? "—"}
                  {s.at && <div>{dateTimeIn(timezone, s.at)}</div>}
                </td>
                <td>
                  {s.cancelledAt ? (
                    <span className="ref due" title={s.cancelReason ?? undefined}>
                      Cancelled
                    </span>
                  ) : canCancel && s.journalNo !== null ? (
                    cancelling === s.id ? (
                      <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                        <input
                          aria-label="Why it is cancelled"
                          placeholder="Why it is cancelled"
                          value={reason}
                          maxLength={300}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <button
                          onClick={() => cancel(s.id)}
                          disabled={busy || reason.trim().length < 3}
                        >
                          Cancel it
                        </button>
                        <button onClick={() => setCancelling(null)} disabled={busy}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setCancelling(s.id)} disabled={busy}>
                        Cancel…
                      </button>
                    )
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
