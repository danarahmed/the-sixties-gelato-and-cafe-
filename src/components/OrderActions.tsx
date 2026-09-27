"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidSaleAction } from "@/lib/actions/sales";
import { listApproversAction, requestApprovalAction, type Approver } from "@/lib/actions/approvals";
import { useT } from "@/lib/i18n/I18nProvider";
import { REASONS, reasonKey, reasonMissing } from "@/lib/reasons";
import { normaliseNumber } from "@/lib/validation";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { RefundDialog, type RefundableSale } from "@/components/RefundDialog";

const small = { minHeight: 28, padding: "0 8px", fontSize: ".75rem" } as const;

/**
 * Void or refund one sale, with a reason from the list the audit trail keeps
 * (0028). A second person may approve it there and then with their name and
 * PIN; without one it waits for the owner on the exceptions report. A refund
 * gives back some of the sale's items, or all that is left of it (0037).
 */
export function OrderActions({
  orderId,
  canVoid,
  canRefund,
  refund,
  businessName,
  timezone,
  me,
}: {
  orderId: string;
  /** A void only while the sale is complete; a refund while anything of it is left. */
  canVoid: boolean;
  canRefund: boolean;
  refund: RefundableSale;
  businessName: string;
  timezone: string;
  me: string;
}) {
  const op = useOperation();
  const router = useRouter();
  const { t, msg: say } = useT();
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
    if (m === "refund") return;
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
      const r = await op.run("voidSale", (key) => voidSaleAction(input, key));
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: t("Voided (journal {no}).", { no: r.data.journalNo ?? "—" }) });
      setMode(null);
      router.refresh();
    });
  }

  if (msg?.ok) return <span className="badge ok">{msg.text}</span>;

  if (mode === "refund") {
    return (
      <RefundDialog
        sale={refund}
        businessName={businessName}
        timezone={timezone}
        me={me}
        onClose={() => setMode(null)}
      />
    );
  }

  if (!mode) {
    if (!canVoid && !canRefund) return null;
    return (
      <span style={{ display: "inline-flex", gap: 6 }}>
        {canVoid && (
          <button onClick={() => choose("void")} style={small}>
            {t("Void")}
          </button>
        )}
        {canRefund && (
          <button onClick={() => choose("refund")} style={small}>
            {t("Refund")}
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
        aria-label={t("Why void it?")}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ minHeight: 28, fontSize: ".8rem" }}
        autoFocus
      >
        <option value="">{t("Why void it?")}</option>
        {REASONS[mode].map((c) => (
          <option key={c} value={c}>
            {t(reasonKey(mode, c))}
          </option>
        ))}
      </select>
      {(code === "other" || note) && (
        <input
          aria-label={t("pos.reasonNote")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            code === "other" ? t("What happened, in a few words") : t("A note (optional)")
          }
          style={{ minHeight: 28, width: 190, fontSize: ".8rem" }}
          maxLength={300}
        />
      )}
      <select
        aria-label={t("Approved by")}
        value={approver}
        onChange={(e) => {
          setApprover(e.target.value);
          setPin("");
        }}
        disabled={approvers === null}
        style={{ minHeight: 28, fontSize: ".8rem" }}
      >
        <option value="">
          {approvers === null ? "…" : t("No second person (the owner reviews it)")}
        </option>
        {(approvers ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            {t("Approved by {name}", { name: a.name })}
          </option>
        ))}
      </select>
      {approver && approval?.approver !== approver && (
        <input
          aria-label={t("Their PIN")}
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          placeholder="PIN" // i18n-ignore: PIN is PIN in every language
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
        {busy ? "…" : t("Confirm void")}
      </button>
      <button
        onClick={() => {
          setMode(null);
          setMsg(null);
        }}
        disabled={busy}
        style={small}
      >
        {t("Cancel")}
      </button>
      {missing === "say" && note.trim() !== "" && (
        <span className="muted" style={{ fontSize: ".75rem", flexBasis: "100%", textAlign: "end" }}>
          {t("pos.sayWhat")}
        </span>
      )}
      {msg && !msg.ok && (
        <span className="red" style={{ fontSize: ".75rem", flexBasis: "100%", textAlign: "end" }}>
          {say(msg.text)}
        </span>
      )}
      <OperationStatus op={op} />
    </span>
  );
}
