"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Approval, ApprovalKind } from "@/lib/db/approvals";
import { approveCountAction, rejectCountAction, reviewLossAction } from "@/lib/actions/stock";
import { approvePurchaseOrderAction, cancelPurchaseOrderAction } from "@/lib/actions/purchasing";
import { approvePayrollAction } from "@/lib/actions/payroll";
import { fmtIQD, fmtQty, movementLabel, unitName } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import type { ActionResult } from "@/lib/db/rpc";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

const KIND_LABEL: Record<ApprovalKind, string> = {
  count: "Stock count",
  loss: "Loss",
  order: "Purchase order",
  payroll: "The month's pay",
};

/** What sending one back is called, and what is asked. */
const SEND_BACK: Record<ApprovalKind, { button: string; ask: string }> = {
  count: { button: "Send back for a recount…", ask: "Why is it sent back? (required)" },
  loss: { button: "Reverse…", ask: "Why is it reversed? (required)" },
  order: { button: "Cancel the order…", ask: "Why is it cancelled? (required)" },
  payroll: { button: "", ask: "" },
};

/**
 * The approvals inbox (E5): one card for each thing waiting, oldest first —
 * what it is, who asked and when, why and how much — with Approve, and a way
 * to send it back with why. What the reader asked for themselves says so.
 */
export function ApprovalsInbox({ items, timezone }: { items: Approval[]; timezone: string }) {
  return (
    <ul className="approvals" data-testid="approvals">
      {items.map((a) => (
        <ApprovalCard key={`${a.kind}:${a.id}`} item={a} timezone={timezone} />
      ))}
    </ul>
  );
}

function Detail({ item }: { item: Approval }) {
  const { t } = useT();
  const d = item.detail;
  if (item.kind === "count")
    return (
      <>
        {t("{n} of {total} item(s) differ", {
          n: Number(d.differ ?? 0),
          total: Number(d.items ?? 0),
        })}
      </>
    );
  if (item.kind === "loss") {
    const unit = typeof d.unit === "string" ? d.unit : null;
    const qty = Number(d.qty ?? 0);
    return (
      <>
        {unit ? `${fmtQty(qty)} ${unitName(unit, t)}` : `×${fmtQty(qty)}`} ·{" "}
        {t(movementLabel(String(d.loss_kind ?? "")))}
      </>
    );
  }
  if (item.kind === "order")
    return (
      <>
        {t("{n} line(s)", { n: Number(d.lines ?? 0) })}
        {d.over_limit === true && <> · {t("Over your limit")}</>}
      </>
    );
  return <>{t("{n} people", { n: Number(d.people ?? 0) })}</>;
}

function ApprovalCard({ item, timezone }: { item: Approval; timezone: string }) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [sending, setSending] = useState(false);
  const [why, setWhy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const back = SEND_BACK[item.kind];

  function decide(approve: boolean) {
    setMsg(null);
    if (!approve && !why.trim()) {
      setMsg({ ok: false, text: t(back.ask) });
      return;
    }
    start(async () => {
      const name = `${approve ? "approve" : "back"}:${item.kind}:${item.id}`;
      const r = await op.run(name, (key): Promise<ActionResult<unknown>> => {
        if (item.kind === "count")
          return approve
            ? approveCountAction({ countId: item.id }, key)
            : rejectCountAction({ countId: item.id, reason: why.trim() }, key);
        if (item.kind === "loss")
          return reviewLossAction(
            {
              movementId: item.id,
              decision: approve ? "approve" : "reverse",
              reason: approve ? null : why.trim(),
            },
            key,
          );
        if (item.kind === "order")
          return approve
            ? approvePurchaseOrderAction({ poId: item.id }, key)
            : cancelPurchaseOrderAction({ poId: item.id, reason: why.trim() }, key);
        return approvePayrollAction({ runId: item.id }, key);
      });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      className="card approval"
      data-testid="approval"
      data-kind={item.kind}
      data-what={item.what}
    >
      <div className="approval-head">
        <span className="badge">{t(KIND_LABEL[item.kind])}</span>
        <strong dir="auto">{item.what}</strong>
        {item.value !== null && <span className="money approval-value">{fmtIQD(item.value)}</span>}
      </div>
      <div className="muted approval-meta">
        <Detail item={item} /> · {item.by ?? "—"} ·{" "}
        <span className="mono">{dateTimeIn(timezone, item.at)}</span>
      </div>
      {item.reason && (
        <div className="approval-why" dir="auto">
          {say(item.reason)}
        </div>
      )}
      <div className="approval-acts">
        {item.mayApprove && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => decide(true)}
            disabled={busy}
            data-testid="approve"
          >
            {busy ? "…" : t("Approve")}
          </button>
        )}
        {item.mayReject && back.button && (
          <button
            type="button"
            onClick={() => setSending((v) => !v)}
            disabled={busy}
            data-testid="send-back"
          >
            {item.kind === "count" && item.mine ? t("Withdraw for a recount") : t(back.button)}
          </button>
        )}
        {!item.mayApprove && item.mine && (
          <span className="muted" style={{ fontSize: ".82rem" }}>
            {t("Someone else approves what you asked for")}
          </span>
        )}
        {!item.mayApprove && !item.mine && item.kind === "order" && (
          <span className="muted" style={{ fontSize: ".82rem" }}>
            {t("Over your limit: a manager with a higher one approves it")}
          </span>
        )}
        <Link href={item.href} className="approval-open">
          {t("Open its page")}
        </Link>
      </div>
      {sending && (
        <div className="approval-back">
          <input
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
            aria-label={t(back.ask)}
            placeholder={t(back.ask)}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            data-testid="send-back-why"
          />
          <button
            type="button"
            onClick={() => decide(false)}
            disabled={busy}
            data-testid="send-back-confirm"
          >
            {t("Confirm")}
          </button>
        </div>
      )}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </li>
  );
}
