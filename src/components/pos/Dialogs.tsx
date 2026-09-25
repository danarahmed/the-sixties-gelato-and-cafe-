"use client";

import { useState } from "react";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { DiningTable, OpenBill } from "@/lib/db/pos";
import type { Approver } from "@/lib/actions/approvals";
import { useT } from "@/lib/i18n/I18nProvider";
import { useChannels } from "@/components/ChannelsProvider";
import { REASONS, reasonKey, reasonMissing } from "@/lib/reasons";
import { normaliseNumber } from "@/lib/validation";

function Modal({
  label,
  busy,
  onClose,
  children,
}: {
  label: string;
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="pos-modal-back" onClick={() => !busy && onClose()}>
      <div
        className="pos-modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Keep an order open to be paid later: for a customer by name, or at a table.
 * From the floor it starts an empty bill; from a quick sale it keeps what was rung up.
 */
export function KeepDialog({
  title,
  tables,
  bills,
  channels,
  initialChannel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  /** Offered when the order can go to a table instead of a name. */
  tables: DiningTable[] | null;
  bills: OpenBill[];
  /** Offered when the bill's channel is still to be chosen. */
  channels: SalesChannel[] | null;
  initialChannel: SalesChannel;
  busy: boolean;
  onConfirm: (choice: {
    label: string | null;
    tableId: string | null;
    channel: SalesChannel;
  }) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const { name: channelName } = useChannels();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<SalesChannel>(initialChannel);
  const ok = name.trim().length > 0;
  return (
    <Modal label={title} busy={busy} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onConfirm({ label: name.trim(), tableId: null, channel });
        }}
      >
        <label className="muted" style={{ display: "block", fontSize: ".85rem" }}>
          {t("pos.customerName")}
          <input
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
        {channels && channels.length > 1 && (
          <div className="seg" style={{ marginTop: 10 }}>
            {channels.map((c) => (
              <button
                type="button"
                key={c}
                className={c === channel ? "active" : ""}
                onClick={() => setChannel(c)}
                disabled={busy}
              >
                {channelName(c)}
              </button>
            ))}
          </div>
        )}
        <div className="pay-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            {t("pos.back")}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !ok}>
            {busy ? "…" : t("pos.keepOpen")}
          </button>
        </div>
      </form>
      {tables && tables.length > 0 && (
        <>
          <h4 className="sc" style={{ margin: "14px 0 6px" }}>
            {t("pos.orAtTable")}
          </h4>
          <div className="table-grid small">
            {tables.map((tb) => {
              const taken = bills.some((b) => b.tableId === tb.id);
              return (
                <button
                  key={tb.id}
                  className={`table-tile${taken ? " busy" : ""}`}
                  disabled={busy}
                  onClick={() => onConfirm({ label: null, tableId: tb.id, channel })}
                >
                  <span className="table-name">{tb.name}</span>
                  <span className="muted">{taken ? t("pos.addsAnotherBill") : t("pos.free")}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}

/** Move a bill to another table (the party moved, or it was opened on the wrong one). */
export function MoveDialog({
  tables,
  bills,
  currentTableId,
  busy,
  onConfirm,
  onClose,
}: {
  tables: DiningTable[];
  bills: OpenBill[];
  currentTableId: string | null;
  busy: boolean;
  onConfirm: (tableId: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Modal label={t("pos.move")} busy={busy} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>{t("pos.moveTo")}</h3>
      <div className="table-grid small">
        {tables
          .filter((tb) => tb.id !== currentTableId)
          .map((tb) => {
            const taken = bills.some((b) => b.tableId === tb.id);
            return (
              <button
                key={tb.id}
                className={`table-tile${taken ? " busy" : ""}`}
                disabled={busy}
                onClick={() => onConfirm(tb.id)}
              >
                <span className="table-name">{tb.name}</span>
                <span className="muted">{taken ? t("pos.addsAnotherBill") : t("pos.free")}</span>
              </button>
            );
          })}
      </div>
      <div className="pay-actions">
        <button onClick={onClose} disabled={busy}>
          {t("pos.back")}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Cancelling a bill with anything on it is a manager's decision, with a reason
 * from the list on the audit trail (0028); "Other" takes a few real words.
 */
export function CancelDialog({
  title,
  needsReason,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  needsReason: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: (reason: { code: string | null; note: string | null }) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const missing = needsReason ? reasonMissing(code || null, note) : null;
  const ok = missing === null;
  return (
    <Modal label={t("pos.cancelBill")} busy={busy} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>
        {t("pos.cancelBill")} — {title}
      </h3>
      <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
        {needsReason ? t("pos.cancelHint") : t("pos.cancelEmptyHint")}
      </p>
      {needsReason && (
        <>
          <label className="muted" style={{ display: "block", fontSize: ".85rem" }}>
            {t("pos.reason")}
            <select
              autoFocus
              aria-label={t("pos.reason")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
            >
              <option value="">{t("pos.chooseReason")}</option>
              {REASONS.bill_cancel.map((c) => (
                <option key={c} value={c}>
                  {t(reasonKey("bill_cancel", c))}
                </option>
              ))}
            </select>
          </label>
          {code === "other" && (
            <label className="muted" style={{ display: "block", fontSize: ".85rem", marginTop: 8 }}>
              {t("pos.reasonNote")}
              <input
                aria-label={t("pos.reasonNote")}
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
              />
            </label>
          )}
          {missing === "say" && note.trim() !== "" && (
            <p className="muted" style={{ fontSize: ".8rem", margin: "6px 0 0" }}>
              {t("pos.sayWhat")}
            </p>
          )}
        </>
      )}
      {error && (
        <div className="badge err" style={{ whiteSpace: "normal", marginTop: 8 }}>
          ⚠️ {error}
        </div>
      )}
      <div className="pay-actions">
        <button onClick={onClose} disabled={busy}>
          {t("pos.back")}
        </button>
        <button
          className="btn-primary"
          disabled={busy || !ok}
          onClick={() =>
            onConfirm(
              needsReason ? { code, note: note.trim() || null } : { code: null, note: null },
            )
          }
        >
          {busy ? "…" : t("pos.confirmCancel")}
        </button>
      </div>
    </Modal>
  );
}

/**
 * A manager approves a discount over the cap on this till (0028): they choose
 * their name and type their PIN. The database checks the PIN and counts a
 * wrong one; five in fifteen minutes stop that manager's approvals for a while.
 */
export function ApproveDialog({
  what,
  approvers,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  /** What is asked for, as the manager reads it: "20% off · −1,000 IQD · Regular customer". */
  what: string;
  /** Who may approve it; null while the list is on its way. */
  approvers: Approver[] | null;
  busy: boolean;
  error: string | null;
  onConfirm: (approverId: string, pin: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [who, setWho] = useState("");
  const [pin, setPin] = useState("");
  const only = approvers?.length === 1 ? approvers[0]!.id : "";
  const chosen = who || only;
  const ok = chosen !== "" && /^\d{4,8}$/.test(pin);
  return (
    <Modal label={t("pos.approveTitle")} busy={busy} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>{t("pos.approveTitle")}</h3>
      <p style={{ marginTop: 0 }}>
        <strong>{what}</strong>
      </p>
      <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
        {t("pos.approveHint")}
      </p>
      {approvers !== null && approvers.length === 0 ? (
        <p className="muted" style={{ fontSize: ".88rem" }}>
          {t("pos.noApprovers")}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onConfirm(chosen, pin);
          }}
        >
          <label className="muted" style={{ display: "block", fontSize: ".85rem" }}>
            {t("pos.approver")}
            <select
              aria-label={t("pos.approver")}
              value={chosen}
              onChange={(e) => setWho(e.target.value)}
              disabled={busy || approvers === null}
            >
              <option value="">{approvers === null ? "…" : t("pos.chooseApprover")}</option>
              {(approvers ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="muted" style={{ display: "block", fontSize: ".85rem", marginTop: 8 }}>
            {t("pos.pin")}
            <input
              aria-label={t("pos.pin")}
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(normaliseNumber(e.target.value).replace(/\D/g, ""))}
              disabled={busy}
            />
          </label>
          {error && (
            <div className="badge err" style={{ whiteSpace: "normal", marginTop: 8 }}>
              ⚠️ {error}
            </div>
          )}
          <div className="pay-actions">
            <button type="button" onClick={onClose} disabled={busy}>
              {t("pos.back")}
            </button>
            <button type="submit" className="btn-primary" disabled={busy || !ok}>
              {busy ? "…" : t("pos.approve")}
            </button>
          </div>
        </form>
      )}
      {approvers !== null && approvers.length === 0 && (
        <div className="pay-actions">
          <button onClick={onClose}>{t("pos.back")}</button>
        </div>
      )}
    </Modal>
  );
}
