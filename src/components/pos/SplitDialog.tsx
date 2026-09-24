"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import type { PosItem } from "@/lib/db/pos";
import { fmtIQD, fmtQty } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { lineName, linePrice, type Order } from "./model";

/**
 * One table, several payers: choose what moves to a bill of its own. That
 * bill can be paid at once while the rest of the table keeps its bill.
 */
export function SplitDialog({
  order,
  title,
  defaultLabel,
  byId,
  busy,
  onConfirm,
  onClose,
}: {
  order: Order;
  title: string;
  /** What the new bill is called: "2" at a table (shown as "Table 5 · 2"), or "Ali · 2". */
  defaultLabel: string;
  byId: Map<string, PosItem>;
  busy: boolean;
  onConfirm: (move: { lineId: string; qty: number }[], label: string) => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [move, setMove] = useState<Record<string, number>>({});
  const [label, setLabel] = useState(defaultLabel);
  const lines = order.lines.filter((l) => l.lineId);
  const set = (lineId: string, qty: number, max: number) =>
    setMove((m) => ({ ...m, [lineId]: Math.max(0, Math.min(max, qty)) }));
  const chosen = lines.filter((l) => (move[l.lineId!] ?? 0) > 0);
  const movesAll = chosen.length === lines.length && lines.every((l) => move[l.lineId!] === l.qty);
  const amount = chosen.reduce(
    (s, l) =>
      s.plus(new Decimal(linePrice(l, byId, order.channel) ?? 0).times(move[l.lineId!] ?? 0)),
    new Decimal(0),
  );

  return (
    <div className="pos-modal-back" onClick={() => !busy && onClose()}>
      <div
        className="pos-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("pos.split")}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>
          {t("pos.split")} — {title}
        </h3>
        <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
          {t("pos.splitHint")}
        </p>
        <div className="split-lines">
          {lines.map((l) => {
            const n = move[l.lineId!] ?? 0;
            return (
              <div key={l.key} className="split-line">
                <span style={{ flex: 1 }}>
                  {lineName(l, byId, locale)}
                  {l.note && <em className="muted"> · {l.note}</em>}
                  <span className="muted"> × {fmtQty(l.qty)}</span>
                </span>
                <div className="stepper">
                  <button
                    aria-label="−"
                    onClick={() => set(l.lineId!, n - 1, l.qty)}
                    disabled={busy || n === 0}
                  >
                    −
                  </button>
                  <span className="mono">{fmtQty(n)}</span>
                  <button
                    aria-label="+"
                    onClick={() => set(l.lineId!, n + 1, l.qty)}
                    disabled={busy || n >= l.qty}
                  >
                    +
                  </button>
                </div>
                <button
                  className="linklike"
                  onClick={() => set(l.lineId!, n === l.qty ? 0 : l.qty, l.qty)}
                  disabled={busy}
                >
                  {n === l.qty ? t("pos.none") : t("pos.allOfIt")}
                </button>
              </div>
            );
          })}
        </div>
        <label className="muted" style={{ display: "block", fontSize: ".85rem", marginTop: 12 }}>
          {t("pos.newBillName")}
          <input
            value={label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
          />
        </label>
        {movesAll && (
          <p className="red" style={{ fontSize: ".85rem" }}>
            {t("pos.splitAll")}
          </p>
        )}
        <div className="pay-actions">
          <button onClick={onClose} disabled={busy}>
            {t("pos.back")}
          </button>
          <button
            className="btn-primary"
            disabled={busy || chosen.length === 0 || movesAll}
            onClick={() =>
              onConfirm(
                chosen.map((l) => ({ lineId: l.lineId!, qty: move[l.lineId!]! })),
                label.trim(),
              )
            }
          >
            {busy ? "…" : `${t("pos.moveToNewBill")} · ${fmtIQD(amount.toNumber())}`}
          </button>
        </div>
      </div>
    </div>
  );
}
