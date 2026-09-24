"use client";

import { useState } from "react";
import type { PosItem } from "@/lib/db/pos";
import type { SaleReceipt } from "@/lib/actions/sales";
import { fmtIQD, fmtQty } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import {
  isDirty,
  isPlatform,
  itemCount,
  lineAmount,
  lineName,
  linePrice,
  minutesSince,
  orderTotal,
  type Line,
  type Order,
  type Tender,
} from "./model";
import type { PrintJob } from "./PrintSlip";

export interface Receipt extends SaleReceipt {
  tender: Tender;
  change: number | null;
  job: PrintJob;
}

function OrderLine({
  line,
  order,
  byId,
  locked,
  onQty,
  onNote,
}: {
  line: Line;
  order: Order;
  byId: Map<string, PosItem>;
  locked: boolean;
  onQty: (key: string, delta: number) => void;
  onNote: (key: string, note: string | null) => void;
}) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(line.note ?? "");
  const price = linePrice(line, byId, order.channel);
  const amount = lineAmount(line, byId, order.channel);
  const save = () => {
    onNote(line.key, note.trim() || null);
    setEditing(false);
  };
  return (
    <div className="order-line">
      <div className="ol-row">
        <div className="ol-main">
          <span className="ol-name">{lineName(line, byId, locale)}</span>
          <span className="ol-sub muted">
            {price === null ? t("pos.noPrice") : fmtIQD(price)}
            {line.note && <em className="ol-note"> · {line.note}</em>}
          </span>
        </div>
        <div className="stepper">
          <button
            aria-label={`${t("pos.less")} ${lineName(line, byId, locale)}`}
            onClick={() => onQty(line.key, -1)}
            disabled={locked}
          >
            −
          </button>
          <span className="mono">{fmtQty(line.qty)}</span>
          <button
            aria-label={`${t("pos.more")} ${lineName(line, byId, locale)}`}
            onClick={() => onQty(line.key, 1)}
            disabled={locked}
          >
            +
          </button>
        </div>
        <span className="ol-amt mono">{amount === null ? "—" : fmtIQD(amount.toNumber())}</span>
        <button
          className="ol-note-btn"
          title={t("pos.addNote")}
          aria-label={t("pos.addNote")}
          onClick={() => {
            setNote(line.note ?? "");
            setEditing((v) => !v);
          }}
          disabled={locked}
        >
          ✎
        </button>
      </div>
      {editing && (
        <div className="ol-note-edit">
          <input
            autoFocus
            value={note}
            maxLength={200}
            placeholder={t("pos.notePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button onClick={save}>{t("pos.ok")}</button>
        </div>
      )}
    </div>
  );
}

/**
 * The order on the right: what is being sold, what it comes to, and every
 * way to finish it — paid now, kept open for later, printed, split or moved.
 */
export function OrderPanel({
  order,
  title,
  byId,
  busy,
  pending,
  online,
  canVoid,
  canSeeCost,
  hasTables,
  receipt,
  msg,
  autoPrint,
  onAutoPrint,
  onQty,
  onNote,
  onLabel,
  onPay,
  onSave,
  onPrintBill,
  onSplit,
  onMove,
  onCancelBill,
  onKeepForLater,
  onClear,
  onRetry,
  onDiscard,
  onPrintReceipt,
  now,
}: {
  order: Order;
  title: string;
  byId: Map<string, PosItem>;
  busy: string | null;
  pending: boolean;
  online: boolean;
  canVoid: boolean;
  canSeeCost: boolean;
  hasTables: boolean;
  receipt: Receipt | null;
  msg: { ok: boolean; text: string } | null;
  autoPrint: boolean;
  onAutoPrint: (v: boolean) => void;
  onQty: (key: string, delta: number) => void;
  onNote: (key: string, note: string | null) => void;
  onLabel: (label: string) => void;
  onPay: (tender: Tender) => void;
  onSave: () => void;
  onPrintBill: () => void;
  onSplit: () => void;
  onMove: () => void;
  onCancelBill: () => void;
  onKeepForLater: () => void;
  onClear: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  onPrintReceipt: () => void;
  now: number;
}) {
  const { t } = useT();
  const isBill = order.kind === "bill";
  const blocked = busy !== null || pending;
  const empty = order.lines.length === 0;
  const dirty = isDirty(order);
  const total = orderTotal(order, byId);
  const count = itemCount(order);
  const opened = minutesSince(order.openedAt, now);
  const savedWithItems = order.tabId !== null && order.saved !== null && order.saved !== "[]";

  return (
    <div className="card order-panel" aria-live="polite">
      <div className="order-head">
        <div style={{ minWidth: 0 }}>
          <div className="order-title">{title}</div>
          <div className="order-badges">
            <span className="badge">{t(`pos.channel.${order.channel}`)}</span>
            {isBill && order.tabId === null && <span className="badge">{t("pos.newBill")}</span>}
            {isBill && order.printedAt && (
              <span className="badge warn">
                🧾 {t("pos.printed")}
                {order.printCount > 1 ? ` ×${order.printCount}` : ""}
              </span>
            )}
            {dirty && <span className="badge err">{t("pos.notSaved")}</span>}
          </div>
          {isBill && order.openedAt && (
            <div className="muted" style={{ fontSize: ".78rem", marginTop: 3 }}>
              {t("pos.openedBy")} {order.openedBy ?? "—"}
              {opened !== null ? ` · ${opened} ${t("pos.min")}` : ""}
            </div>
          )}
        </div>
      </div>

      {isBill && order.tabId === null && order.tableId === null && (
        <label className="muted" style={{ display: "block", fontSize: ".82rem", marginBottom: 8 }}>
          {t("pos.customerName")}
          <input
            value={order.label ?? ""}
            maxLength={60}
            onChange={(e) => onLabel(e.target.value)}
            disabled={blocked}
          />
        </label>
      )}

      <div className="order-lines">
        {empty ? (
          <p className="muted" style={{ margin: "10px 0" }}>
            {receipt ? t("pos.nextCustomer") : t("pos.tapToAdd")}
          </p>
        ) : (
          order.lines.map((l) => (
            <OrderLine
              key={l.key}
              line={l}
              order={order}
              byId={byId}
              locked={blocked}
              onQty={onQty}
              onNote={onNote}
            />
          ))
        )}
      </div>

      <div className="order-foot">
        {!empty && (
          <div className="order-total">
            <span>
              {t("pos.total")}{" "}
              <span className="muted">
                · {fmtQty(count)} {t("pos.items")}
              </span>
            </span>
            <strong className="mono">{fmtIQD(total.toNumber())}</strong>
          </div>
        )}

        {pending ? (
          <div className="order-actions">
            <button className="btn-primary big" disabled={busy !== null} onClick={onRetry}>
              {busy ? "…" : t("pos.retry")}
            </button>
            <button onClick={onDiscard} disabled={busy !== null}>
              {t("pos.discardPending")}
            </button>
          </div>
        ) : (
          !empty && (
            <>
              <div className="order-actions">
                {isPlatform(order.channel) ? (
                  <button
                    className="btn-primary big"
                    disabled={blocked || !online}
                    onClick={() => onPay("platform_paid")}
                  >
                    🧾 {t("pos.platformPaid")}
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-primary big"
                      disabled={blocked || !online}
                      onClick={() => onPay("cash")}
                    >
                      💵 {t("pos.cash")}
                    </button>
                    <button
                      className="btn-primary big"
                      disabled={blocked || !online}
                      onClick={() => onPay("card")}
                    >
                      💳 {t("pos.card")}
                    </button>
                  </>
                )}
              </div>
              <div className="order-actions secondary">
                {isBill ? (
                  <>
                    <button
                      onClick={onSave}
                      disabled={blocked || !online || !(dirty || order.tabId === null)}
                    >
                      💾 {t("pos.save")}
                    </button>
                    <button onClick={onPrintBill} disabled={blocked || !online}>
                      🖨 {t("pos.printBill")}
                    </button>
                    <button
                      onClick={onSplit}
                      disabled={blocked || !online || order.tabId === null || count < 2}
                    >
                      ✂ {t("pos.split")}
                    </button>
                    {hasTables && (
                      <button onClick={onMove} disabled={blocked || !online}>
                        ⇄ {t("pos.move")}
                      </button>
                    )}
                    <button
                      onClick={onCancelBill}
                      disabled={
                        blocked || (savedWithItems && !canVoid) || (order.tabId !== null && !online)
                      }
                      title={savedWithItems && !canVoid ? t("pos.cancelNeedsManager") : undefined}
                    >
                      ✕ {t("pos.cancelBill")}
                    </button>
                  </>
                ) : (
                  <>
                    {!isPlatform(order.channel) && (
                      <button onClick={onKeepForLater} disabled={blocked || !online}>
                        🕒 {t("pos.keepForLater")}
                      </button>
                    )}
                    <button onClick={onClear} disabled={blocked}>
                      {t("pos.clear")}
                    </button>
                  </>
                )}
              </div>
            </>
          )
        )}
        {isBill && empty && !pending && (
          <div className="order-actions secondary">
            <button onClick={onCancelBill} disabled={blocked || (order.tabId !== null && !online)}>
              ✕ {order.tabId === null ? t("pos.close") : t("pos.cancelBill")}
            </button>
          </div>
        )}
        {!online && !pending && (
          <p className="red" style={{ fontSize: ".82rem", margin: "6px 0 0" }}>
            {t("pos.offlineBlocked")}
          </p>
        )}

        <div style={{ marginTop: 8 }}>
          <Notice msg={msg} />
        </div>

        {receipt && (
          <div className="receipt-card">
            <div className="deduction-row">
              <strong>
                ✅ {t("pos.recorded")} · {receipt.orderId.slice(0, 8)}
              </strong>
              <span className="badge ok">{t(`pos.tender.${receipt.tender}`)}</span>
            </div>
            <p className="muted" style={{ fontSize: ".85rem", margin: "4px 0" }}>
              {fmtIQD(receipt.net)}
              {receipt.journalNo !== null ? ` · ${t("pos.journal")} ${receipt.journalNo}` : ""}
              {canSeeCost && receipt.cogs !== undefined
                ? ` · ${t("pos.cost")} ${fmtIQD(receipt.cogs)}`
                : ""}
            </p>
            {receipt.change !== null && (
              <div className="change-row">
                <span>{t("pos.changeDue")}</span>
                <strong className="mono change-amt">{fmtIQD(receipt.change)}</strong>
              </div>
            )}
            <button onClick={onPrintReceipt} style={{ marginTop: 6 }}>
              🖨 {t("pos.printReceipt")}
            </button>
          </div>
        )}

        <label className="autoprint muted">
          <input
            type="checkbox"
            checked={autoPrint}
            onChange={(e) => onAutoPrint(e.target.checked)}
          />{" "}
          {t("pos.autoPrint")}
        </label>
      </div>
    </div>
  );
}
