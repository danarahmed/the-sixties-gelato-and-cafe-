"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refundSaleAction, voidSaleAction } from "@/lib/actions/sales";
import { fmtIQD } from "@/lib/format";

/** Void or refund one sale, with the reason the audit trail keeps. */
export function OrderActions({
  orderId,
  canVoid,
  canRefund,
}: {
  orderId: string;
  canVoid: boolean;
  canRefund: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [mode, setMode] = useState<"void" | "refund" | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function confirm() {
    if (!mode) return;
    setMsg(null);
    start(async () => {
      let text: string;
      if (mode === "void") {
        const r = await voidSaleAction({ orderId, reason });
        if (!r.ok) {
          setMsg({ ok: false, text: r.error });
          return;
        }
        text = `Voided (journal ${r.data.journalNo ?? "—"}).`;
      } else {
        const r = await refundSaleAction({ orderId, reason });
        if (!r.ok) {
          setMsg({ ok: false, text: r.error });
          return;
        }
        text = `Refunded ${fmtIQD(r.data.refunded)} (journal ${r.data.journalNo ?? "—"}).`;
      }
      setMsg({ ok: true, text });
      setMode(null);
      setReason("");
      router.refresh();
    });
  }

  if (msg?.ok) return <span className="badge ok">{msg.text}</span>;

  if (!mode) {
    return (
      <span style={{ display: "inline-flex", gap: 6 }}>
        {canVoid && (
          <button
            onClick={() => setMode("void")}
            style={{ minHeight: 28, padding: "0 8px", fontSize: ".75rem" }}
          >
            Void
          </button>
        )}
        {canRefund && (
          <button
            onClick={() => setMode("refund")}
            style={{ minHeight: 28, padding: "0 8px", fontSize: ".75rem" }}
          >
            Refund
          </button>
        )}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "end",
      }}
    >
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={mode === "void" ? "Why void it?" : "Why refund it?"}
        style={{ minHeight: 28, width: 170, fontSize: ".8rem" }}
        autoFocus
        maxLength={300}
      />
      <button
        className="btn-primary"
        onClick={confirm}
        disabled={busy || !reason.trim()}
        style={{ minHeight: 28, padding: "0 8px", fontSize: ".75rem" }}
      >
        {busy ? "…" : mode === "void" ? "Confirm void" : "Confirm refund"}
      </button>
      <button
        onClick={() => {
          setMode(null);
          setMsg(null);
        }}
        disabled={busy}
        style={{ minHeight: 28, padding: "0 8px", fontSize: ".75rem" }}
      >
        Cancel
      </button>
      {msg && !msg.ok && (
        <span className="red" style={{ fontSize: ".75rem", flexBasis: "100%", textAlign: "end" }}>
          {msg.text}
        </span>
      )}
    </span>
  );
}
