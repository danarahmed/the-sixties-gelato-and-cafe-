"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refundLinesAction, type RefundResult } from "@/lib/actions/sales";
import { listApproversAction, requestApprovalAction, type Approver } from "@/lib/actions/approvals";
import { fmtIQD, fmtQty } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { REASONS, reasonKey, reasonMissing } from "@/lib/reasons";
import { allThatIsLeft, leftOf, refundPlan, type RefundableLine } from "@/lib/refunds";
import {
  checkRefundSplit,
  proportionalParts,
  refundSplitMessage,
  wayKey,
  type LeftToGiveBack,
} from "@/lib/payments";
import { normaliseNumber } from "@/lib/validation";
import { Modal } from "@/components/pos/Dialogs";
import { PrintSlip, type PrintJob } from "@/components/pos/PrintSlip";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";

export interface RefundableSale {
  orderId: string;
  lines: RefundableLine[];
  /** How it was paid: the money goes back the same way. */
  tender: string;
  /** What is left of each way it was paid (0042): a sale paid two ways gives back each its part. */
  left?: LeftToGiveBack[];
  channelLabel: string;
  /** Over this, the refunder's limit, a second person approves it (0040); null: no limit known. */
  approvalOver?: number | null;
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
  // Paid more than one way (0042): each way gives back its part, in proportion
  // to what is left of it unless the refunder types otherwise.
  const ways = (sale.left ?? []).filter((l) => l.left > 0);
  const splitting = ways.length > 1;
  const [typed, setTyped] = useState<Record<string, string> | null>(null);
  const shares = proportionalParts(
    ways.map((w) => w.left),
    plan.total,
  );
  const parts =
    typed ?? Object.fromEntries(ways.map((w, i) => [wayKey(w), String(shares[i] ?? 0)]));
  const split = splitting ? checkRefundSplit(ways, parts, plan.total) : null;
  // A new refund amount starts again from the shares.
  useEffect(() => setTyped(null), [plan.total]);
  const missing = reasonMissing(code || null, note);
  // Over the limit of the refunder's roles, a second person is not optional (0040).
  const needsSecond =
    sale.approvalOver !== null && sale.approvalOver !== undefined && plan.total > sale.approvalOver;

  useEffect(() => {
    void listApproversAction("refund").then((r) => setApprovers(r.ok ? r.data : []));
  }, []);

  const how = (tender: string, name?: string) =>
    tender === "cash"
      ? t("in cash, from the drawer")
      : tender === "card"
        ? t("to the card it was paid with")
        : tender === "other"
          ? t("by {name}, the way it was paid", { name: name ?? "" })
          : t("off what the platform owes");
  /** Each way's part, as a phrase: "333 in cash, from the drawer; 667 to the card it was paid with". */
  const howEach = (
    list: { type: string; amount: number; methodName?: string; method?: string }[],
  ) =>
    list
      .map(
        (x) =>
          `${fmtIQD(x.amount)} ${how(x.type, x.methodName ?? ways.find((w) => w.method && w.method === x.method)?.name)}`,
      )
      .join("; ");
  /** A way of paying's name: one of the café's own by its name (0069). */
  const wayName = (w: LeftToGiveBack) =>
    w.type === "other" ? (w.name ?? t("Other way to pay")) : t(`pos.tender.${w.type}`);
  // The one way a sale was paid, by its name when it is one of the café's.
  const oneName = sale.left?.find((l) => l.type === sale.tender)?.name;

  const problem = (() => {
    const p = plan.problem;
    if (!p || p.kind === "nothing") return null;
    return p.kind === "tooMany"
      ? t("Only {left} of {name} is left to refund", { left: fmtQty(p.left), name: p.name })
      : t("Type how many of {name} go back", { name: p.name });
  })();

  function confirm() {
    if (plan.problem || missing || split?.problem) return;
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
            tenders: split ? split.parts : null,
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
        ...(r.tenders.length > 1 || r.tenders.some((x) => x.methodName)
          ? {
              payments: r.tenders.map((x) => ({
                type: x.type as NonNullable<PrintJob["tender"]>,
                amount: x.amount,
                ...(x.methodName ? { methodName: x.methodName } : {}),
              })),
            }
          : {}),
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
              {done.tenders.length > 1
                ? t("Refund {no}: {amount} given back: {parts} (journal {journal}).", {
                    no: done.refundNo,
                    amount: fmtIQD(done.refunded),
                    parts: howEach(done.tenders),
                    journal: done.journalNo ?? "—",
                  })
                : t("Refund {no}: {amount} given back {how} (journal {journal}).", {
                    no: done.refundNo,
                    amount: fmtIQD(done.refunded),
                    how: how(done.tender, done.tenders[0]?.methodName ?? oneName),
                    journal: done.journalNo ?? "—",
                  })}{" "}
              {done.whole
                ? t("Nothing of the sale is left to refund.")
                : t("The rest of the sale can still be refunded.")}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-primary" onClick={() => printSlip(done)}>
                <Icon name="print" /> {t("Print the refund slip")}
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
                {split
                  ? t("Gives back {amount}: {parts}", {
                      amount: fmtIQD(plan.total),
                      parts: howEach(split.parts),
                    })
                  : t("Gives back {amount} {how}", {
                      amount: fmtIQD(plan.total),
                      how: how(sale.tender, oneName),
                    })}
              </strong>
              {split && (
                <div
                  style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}
                  data-testid="refund-split"
                >
                  {ways.map((w) => (
                    <label key={wayKey(w)} className="muted" style={{ fontSize: ".85rem" }}>
                      {t("{way}, at most {left}", {
                        way: wayName(w),
                        left: fmtIQD(w.left),
                      })}{" "}
                      <input
                        aria-label={t("Given back {way}", { way: wayName(w) })}
                        className="amt"
                        inputMode="numeric"
                        style={{ width: 90, textAlign: "end" }}
                        value={parts[wayKey(w)] ?? ""}
                        onChange={(e) =>
                          setTyped({ ...parts, [wayKey(w)]: normaliseNumber(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              {split?.problem && (
                <div
                  className="red"
                  style={{ fontSize: ".85rem" }}
                  data-testid="refund-split-problem"
                >
                  {say(refundSplitMessage(split.problem, plan.total))}
                </div>
              )}
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
            {needsSecond && (
              <span
                className={approver ? "muted" : "red"}
                style={{ fontSize: ".85rem" }}
                data-testid="refund-needs-second"
              >
                {t(
                  "Over {limit}, a second person approves it: choose who, and they type their PIN.",
                  {
                    limit: fmtIQD(sale.approvalOver ?? 0),
                  },
                )}
              </span>
            )}
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
                  (split !== null && split.problem !== null) ||
                  missing !== null ||
                  (needsSecond && approver === "") ||
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
