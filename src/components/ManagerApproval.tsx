"use client";

import { useEffect, useState, useTransition } from "react";
import { listApproversAction, requestApprovalAction, type Approver } from "@/lib/actions/approvals";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * A manager approves it here, with their name and PIN (0040): a loss over the
 * limit, or stock used beyond what the books hold. The approval is good once,
 * for ten minutes, for the person who asked; the form sends it with the same
 * submission again. A wrong PIN is counted by the database.
 */
export function ManagerApproval({
  kind,
  items,
  onApproved,
}: {
  kind: "waste" | "negative_stock";
  /** What is approved, as the person sees it: kept with the approval. */
  items: string;
  onApproved: (approval: { id: string; approver: string }) => void;
}) {
  const { t, msg: say } = useT();
  const [approvers, setApprovers] = useState<Approver[] | null>(null);
  const [approver, setApprover] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    void listApproversAction(kind).then((r) => setApprovers(r.ok ? r.data : []));
  }, [kind]);

  function approve() {
    setError(null);
    start(async () => {
      const a = await requestApprovalAction({
        kind,
        approverId: approver,
        pin,
        scope: { items: items.slice(0, 300) },
      });
      if (!a.ok) {
        setError(a.error);
        return;
      }
      setPin("");
      onApproved({ id: a.data.approvalId, approver: a.data.approver });
    });
  }

  return (
    <div
      className="grid"
      style={{ gap: 6 }}
      data-testid="manager-approval"
      onKeyDown={(e) => {
        if (e.key === "Enter" && approver && /^\d{4,8}$/.test(pin)) {
          e.preventDefault();
          approve();
        }
      }}
    >
      {approvers !== null && approvers.length === 0 ? (
        <span className="muted" style={{ fontSize: ".85rem" }}>
          {t("pos.noApprovers")}
        </span>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            aria-label={t("pos.approver")}
            value={approver}
            onChange={(e) => {
              setApprover(e.target.value);
              setPin("");
            }}
            disabled={approvers === null}
          >
            <option value="">{approvers === null ? "…" : t("pos.chooseApprover")}</option>
            {(approvers ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {approver && (
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
          <button
            type="button"
            onClick={approve}
            disabled={busy || !approver || !/^\d{4,8}$/.test(pin)}
          >
            {busy ? "…" : t("pos.approve")}
          </button>
        </div>
      )}
      {error && (
        <span className="red" style={{ fontSize: ".85rem" }}>
          {say(error)}
        </span>
      )}
    </div>
  );
}
