"use client";

import { useRef, useState, useTransition } from "react";
import { giveAwayAction, type Giveaway } from "@/lib/actions/sales";
import {
  GIVEAWAY_KINDS,
  NEEDS_APPROVAL,
  NEEDS_STOCK_APPROVAL,
  type GiveawayKind,
} from "@/lib/losses";
import { useT } from "@/lib/i18n/I18nProvider";
import { ManagerApproval } from "@/components/ManagerApproval";
import { Modal } from "./Dialogs";
import { Icon } from "@/components/Icon";

export interface GiveawayLine {
  variantId: string;
  qty: number;
  addons: { modifierId: string; qty: number }[];
}

/**
 * What is in the cart, given away (0048): a staff meal, on the house, or a
 * sample, with why. It is not a sale: no revenue, no payment. Its cost goes to
 * the kind's own account, and the bar makes it by its turn number. Over the
 * limit a manager approves it here, with their PIN: nothing waits at the till.
 */
export function GiveAwayDialog({
  lines,
  channel,
  summary,
  onDone,
  onClose,
}: {
  lines: GiveawayLine[];
  channel: "dine_in" | "takeaway";
  /** What is given, as the cashier sees it: "2 × Espresso, Latte". */
  summary: string;
  onDone: (g: Giveaway, kind: GiveawayKind) => void;
  onClose: () => void;
}) {
  const { t, msg: say } = useT();
  const [kind, setKind] = useState<GiveawayKind | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsManager, setNeedsManager] = useState(false);
  const [busy, start] = useTransition();
  // One giveaway, one key: a retry after a lost answer is recorded once.
  const key = useRef<string>(crypto.randomUUID());

  function give(approvalId: string | null) {
    if (!kind) return;
    setError(null);
    start(async () => {
      const r = await giveAwayAction({
        key: key.current,
        kind,
        channel,
        lines,
        reason,
        approvalId,
      });
      if (r.ok) {
        onDone(r.data, kind);
        return;
      }
      setNeedsManager(NEEDS_APPROVAL.test(r.error) || NEEDS_STOCK_APPROVAL.test(r.error));
      setError(r.error);
    });
  }

  return (
    <Modal label={t("Give away")} busy={busy} onClose={onClose}>
      <div className="grid" style={{ gap: 12 }} data-testid="giveaway-dialog">
        <h3 style={{ margin: 0 }}>
          <Icon name="gift" /> {t("Give away")}
        </h3>
        <p className="muted" style={{ margin: 0 }}>
          {summary}
        </p>
        <div
          role="radiogroup"
          aria-label={t("What is it?")}
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          }}
        >
          {GIVEAWAY_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              className={kind === k.kind ? "btn-primary" : undefined}
              style={{ textAlign: "start", padding: "10px 12px" }}
              onClick={() => {
                setKind(k.kind);
                setNeedsManager(false);
                setError(null);
              }}
            >
              <b>{t(k.label)}</b>
              <br />
              <span style={{ fontSize: ".8rem" }}>{t(k.explain)}</span>
            </button>
          ))}
        </div>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: ".85rem" }}>
            {t("Why (required)")}
          </span>
          <input
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            style={{ minHeight: 44, borderRadius: 8, padding: "0 12px" }}
          />
        </label>
        <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
          {t(
            "Nothing is charged: it is not a sale. What it costs goes to its own account, and the bar makes it by its number.",
          )}
        </p>
        {needsManager && (
          <div className="card grid" style={{ gap: 8 }} data-testid="giveaway-approval">
            <b style={{ fontSize: ".9rem" }}>{t("A manager approves it now, with their PIN:")}</b>
            <ManagerApproval kind="waste" items={summary} onApproved={(a) => give(a.id)} />
          </div>
        )}
        {error && (
          <p className="red" style={{ margin: 0 }} role="alert">
            {say(error)}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} disabled={busy}>
            {t("pos.back")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || kind === null || !reason.trim()}
            onClick={() => give(null)}
          >
            {busy ? "…" : t("Give it away")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
