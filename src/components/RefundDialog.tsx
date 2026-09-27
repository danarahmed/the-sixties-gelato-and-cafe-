"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refundLinesAction, type RefundResult } from "@/lib/actions/sales";
import { listApproversAction, requestApprovalAction, type Approver } from "@/lib/actions/approvals";
import { fmtIQD, fmtQty } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { REASONS, reasonKey, reasonMissing } from "@/lib/reasons";
import { allThatIsLeft, leftOf, refundPlan, type RefundableLine } from "@/lib/refunds";
import { normaliseNumber } from "@/lib/validation";
import { Modal } from "@/components/pos/Dialogs";
import { PrintSlip, type PrintJob } from "@/components/pos/PrintSlip";
import { OperationStatus, useOperation } from "@/components/useOperation";

export interface RefundableSale {
  orderId: string;
  lines: RefundableLine[];
  /** How it was paid: the money goes back the same way. */
  tender: string;
  channelLabel: string;
}

/**
 * Refund some of a sale's items, or all that is left of it (0037): how many
 * of each go back (all that is left, to begin with), what each gives back as
 * the database works it out, the reason, and a second person's approval when
 * there is one. The answer names the refund and where the money went, and its
 * slip prints on the till's printer.
 */
export function RefundDialog({
  sale,
  businessName,
  timezone,
  me,
  onClose,
}: {
  sale: RefundableSale;
  businessName: string;
  timezone: string;
  me: string;
  onClose: () => void;
}) {
  const op = useOperation();
  const router = useRouter();
  const { t, msg: say } = useT();
  const [busy, start] = useTransition();
  const [wants, setWants] = useState<Record<string, string>>(() => allThatIsLeft(sale.lines));
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [approvers, setApprovers] = useState<Approver[] | null>(null);
  const [approver, setApprover] = useState("");
  const [pin, setPin] = useState("");
  // Kept if the refund itself is then refused, so the PIN is not asked again.
  const [approval, setApproval] = useState<{ approver: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RefundResult | null>(null);
  const [slip, setSlip] = useState<PrintJob[] | null>(null);
  const plan = refundPlan(sale.lines, wants);
  const missing = reasonMissing(code || null, note);

  useEffect(() => {
    void listApproversAction("refund").then((r) => setApprovers(r.ok ? r.data : []));
  }, []);

  const how = (tender: string) =>
    tender === "cash"
      ? t("in cash, from the drawer")
      : tender === "card"
        ? t("to the card it was paid with")
        : t("off what the platform owes");

  const problem = (() => {
    const p = plan.problem;
    if (!p || p.kind === "nothing") return null;
    return p.kind === "tooMany"
      ? t("Only {left} of {name} is left to refund", { left: fmtQty(p.left), name: p.name })
      : t("Type how many of {name} go back", { name: p.name });
  })();

  function confirm() {
    if (plan.problem || missing) return;
    setError(null);
    start(async () => {
      let approvalId: string | null = null;
      if (approver) {
        if (approval?.approver === approver) approvalId = approval.id;
        else {
          const a = await requestApprovalAction({
            kind: "refund",
            approverId: approver,
            pin,
            scope: { order_id: sale.orderId },
          });
          if (!a.ok) {
            setError(a.error);
            return;
          }
          approvalId = a.data.approvalId;
          setApproval({ approver, id: approvalId });
        }
      }
      const r = await op.run("refundLines", (key) =>
        refundLinesAction(
          {
            orderId: sale.orderId,
            lines: plan.lines.map((l) => ({ lineId: l.lineId, qty: l.qty })),
            reasonCode: code,
            note: note.trim() || null,
            approvalId,
          },
          key,
        ),
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(r.data);
      router.refresh();
    });
  }

  function printSlip(r: RefundResult) {
    const reason = code === "other" ? note.trim() : t(reasonKey("refund", code));
    setSlip([
      {
        kind: "refund",
        title: t("print.refundNo").replace("{no}", String(r.refundNo)),
        channelLabel: sale.channelLabel,
        lines: r.lines.map((l) => ({ name: l.name, qty: l.qty, amount: l.amount, note: null })),
        total: r.refunded,
        tender: r.tender as PrintJob["tender"],
        reference: sale.orderId.slice(0, 8),
        journalNo: r.journalNo,
        note: reason || null,
        at: new Date().toISOString(),
        by: me,
      },
    ]);
  }

  return (
    <Modal label={t("Refund")} busy={busy} onClose={onClose}>
      <div data-testid="refund-dialog" style={{ display: "grid", gap: 12, minWidth: 0 }}>
        <h3 style={{ margin: 0 }}>{t("Refund sale {sale}", { sale: sale.orderId.slice(0, 8) })}</h3>

        {done ? (
          <>
            <div className="badge ok" style={{ whiteSpace: "normal" }} data-testid="refund-answer">
              {t("Refund {no}: {amount} given back {how} (journal {journal}).", {
                no: done.refundNo,
                amount: fmtIQD(done.refunded),
                how: how(done.tender),
                journal: done.journalNo ?? "—",
              })}{" "}
              {done.whole
                ? t("Nothing of the sale is left to refund.")
                : t("The rest of the sale can still be refunded.")}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-primary" onClick={() => printSlip(done)}>
                🖨 {t("Print the refund slip")}
              </button>
              <button onClick={onClose}>{t("pos.close")}</button>
            </div>
          </>
        ) : (
          <>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>{t("Item")}</th>
                    <th className="right">{t("On the sale")}</th>
                    <th className="right">{t("Given back")}</th>
                    <th className="right">{t("Refund now")}</th>
                    <th className="right">{t("Gives back")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((l) => {
                    const left = leftOf(l);
                    const line = plan.lines.find((x) => x.lineId === l.id);
                    return (
                      <tr key={l.id}>
                        <td>{l.name}</td>
                        <td className="right mono">
                          {fmtQty(l.qty)} · {fmtIQD(l.lineNet)}
                        </td>
                        <td className="right mono muted">
                          {l.refundedQty > 0 ? fmtQty(l.refundedQty) : "—"}
                        </td>
                        <td className="right">
                          {left.qty > 0 ? (
                            <input
                              aria-label={t("How many of {name} go back", { name: l.name })}
                              className="amt"
                              inputMode="decimal"
                              style={{ width: 70, textAlign: "end" }}
                              value={wants[l.id] ?? ""}
                              onChange={(e) =>
                                setWants((w) => ({ ...w, [l.id]: normaliseNumber(e.target.value) }))
                              }
                              placeholder="0"
                            />
                          ) : (
                            <span className="muted">{t("all given back")}</span>
                          )}
                        </td>
                        <td className="right mono">{line ? fmtIQD(line.amount) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div data-testid="refund-total">
              <strong>
                {t("Gives back {amount} {how}", {
                  amount: fmtIQD(plan.total),
                  how: how(sale.tender),
                })}
              </strong>
              {problem && (
                <div className="red" style={{ fontSize: ".85rem" }}>
                  {problem}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                aria-label={t("Why refund it?")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              >
                <option value="">{t("Why refund it?")}</option>
                {REASONS.refund.map((c) => (
                  <option key={c} value={c}>
                    {t(reasonKey("refund", c))}
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
                  style={{ width: 220 }}
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
                  style={{ width: 110 }}
                />
              )}
            </div>
            {missing === "say" && note.trim() !== "" && (
              <span className="muted" style={{ fontSize: ".8rem" }}>
                {t("pos.sayWhat")}
              </span>
            )}
            {error && (
              <span className="red" style={{ fontSize: ".85rem" }}>
                {say(error)}
              </span>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn-primary"
                onClick={confirm}
                disabled={
                  busy ||
                  plan.problem !== null ||
                  missing !== null ||
                  (approver !== "" && approval?.approver !== approver && !/^\d{4,8}$/.test(pin))
                }
              >
                {busy ? "…" : t("Confirm refund")}
              </button>
              <button onClick={onClose} disabled={busy}>
                {t("Cancel")}
              </button>
            </div>
            <OperationStatus op={op} />
          </>
        )}
      </div>
      <PrintSlip
        slips={slip}
        businessName={businessName}
        timezone={timezone}
        onDone={() => setSlip(null)}
      />
    </Modal>
  );
}
