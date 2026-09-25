"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refundSaleAction, voidSaleAction } from "@/lib/actions/sales";
import { listApproversAction, requestApprovalAction, type Approver } from "@/lib/actions/approvals";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { REASONS, reasonKey, reasonMissing } from "@/lib/reasons";
import { normaliseNumber } from "@/lib/validation";

const small = { minHeight: 28, padding: "0 8px", fontSize: ".75rem" } as const;

/**
 * Void or refund one sale, with a reason from the list the audit trail keeps
 * (0028). A second person may approve it there and then with their name and
 * PIN; without one it waits for the owner on the exceptions report.
 */
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
  const { t } = useT();
  const [busy, start] = useTransition();
  const [mode, setMode] = useState<"void" | "refund" | null>(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [approvers, setApprovers] = useState<Approver[] | null>(null);
  const [approver, setApprover] = useState("");
  const [pin, setPin] = useState("");
  // Kept if the correction itself is then refused, so the PIN is not asked again.
  const [approval, setApproval] = useState<{ approver: string; id: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const missing = reasonMissing(code || null, note);

  function choose(m: "void" | "refund") {
    setMode(m);
    setCode("");
    setNote("");
    setApprover("");
    setPin("");
    setApproval(null);
    setMsg(null);
    setApprovers(null);
    void listApproversAction(m).then((r) => setApprovers(r.ok ? r.data : []));
  }

  function confirm() {
    if (!mode || missing) return;
    setMsg(null);
    start(async () => {
      let approvalId: string | null = null;
      if (approver) {
        if (approval?.approver === approver) approvalId = approval.id;
        else {
          const a = await requestApprovalAction({
            kind: mode,
            approverId: approver,
            pin,
            scope: { order_id: orderId },
          });
          if (!a.ok) {
            setMsg({ ok: false, text: a.error });
            return;
          }
          approvalId = a.data.approvalId;
          setApproval({ approver, id: approvalId });
        }
      }
      const input = { orderId, reasonCode: code, note: note.trim() || null, approvalId };
      let text: string;
      if (mode === "void") {
        const r = await voidSaleAction(input);
        if (!r.ok) {
          setMsg({ ok: false, text: r.error });
          return;
        }
        text = `Voided (journal ${r.data.journalNo ?? "—"}).`;
      } else {
        const r = await refundSaleAction(input);
        if (!r.ok) {
          setMsg({ ok: false, text: r.error });
          return;
        }
        text = `Refunded ${fmtIQD(r.data.refunded)} (journal ${r.data.journalNo ?? "—"}).`;
      }
      setMsg({ ok: true, text });
      setMode(null);
      router.refresh();
    });
  }

  if (msg?.ok) return <span className="badge ok">{msg.text}</span>;

  if (!mode) {
    return (
      <span style={{ display: "inline-flex", gap: 6 }}>
        {canVoid && (
          <button onClick={() => choose("void")} style={small}>
            Void
          </button>
        )}
        {canRefund && (
          <button onClick={() => choose("refund")} style={small}>
            Refund
          </button>
        )}
      </span>
    );
  }

  return (
    <span
      data-testid="order-correction"
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "end",
        maxWidth: 420,
      }}
    >
      <select
        aria-label={mode === "void" ? "Why void it?" : "Why refund it?"}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ minHeight: 28, fontSize: ".8rem" }}
        autoFocus
      >
        <option value="">{mode === "void" ? "Why void it?" : "Why refund it?"}</option>
        {REASONS[mode].map((c) => (
          <option key={c} value={c}>
            {t(reasonKey(mode, c))}
          </option>
        ))}
      </select>
      {(code === "other" || note) && (
        <input
          aria-label="In a few words"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={code === "other" ? "What happened, in a few words" : "A note (optional)"}
          style={{ minHeight: 28, width: 190, fontSize: ".8rem" }}
          maxLength={300}
        />
      )}
      <select
        aria-label="Approved by"
        value={approver}
        onChange={(e) => {
          setApprover(e.target.value);
          setPin("");
        }}
        disabled={approvers === null}
        style={{ minHeight: 28, fontSize: ".8rem" }}
      >
        <option value="">
          {approvers === null ? "…" : "No second person (the owner reviews it)"}
        </option>
        {(approvers ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            Approved by {a.name}
          </option>
        ))}
      </select>
      {approver && approval?.approver !== approver && (
        <input
          aria-label="Their PIN"
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(normaliseNumber(e.target.value).replace(/\D/g, ""))}
          style={{ minHeight: 28, width: 110, fontSize: ".9rem" }}
        />
      )}
      <button
        className="btn-primary"
        onClick={confirm}
        disabled={
          busy ||
          missing !== null ||
          (approver !== "" && approval?.approver !== approver && !/^\d{4,8}$/.test(pin))
        }
        style={small}
      >
        {busy ? "…" : mode === "void" ? "Confirm void" : "Confirm refund"}
      </button>
      <button
        onClick={() => {
          setMode(null);
          setMsg(null);
        }}
        disabled={busy}
        style={small}
      >
        Cancel
      </button>
      {missing === "say" && note.trim() !== "" && (
        <span className="muted" style={{ fontSize: ".75rem", flexBasis: "100%", textAlign: "end" }}>
          Say what happened, in a few words.
        </span>
      )}
      {msg && !msg.ok && (
        <span className="red" style={{ fontSize: ".75rem", flexBasis: "100%", textAlign: "end" }}>
          {msg.text}
        </span>
      )}
    </span>
  );
}
