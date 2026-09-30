"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  correctReceiptAction,
  previewReceiptCorrectionAction,
  reverseReceiptAction,
  type CorrectionPlan,
  type CorrectionResult,
} from "@/lib/actions/purchasing";
import { fmtIQD, fmtQty, unitName } from "@/lib/format";
import { arrows } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/I18nProvider";
import { normaliseNumber } from "@/lib/validation";
import { Modal } from "@/components/pos/Dialogs";
import { OperationStatus, useOperation } from "@/components/useOperation";

export interface CorrectableReceipt {
  id: string;
  receiptNo: number | null;
  /** The day it came, as it stands. */
  receivedOn: string;
  /** The days its date may be corrected to: the month it was entered, up to today. */
  firstDay: string;
  lastDay: string;
  supplierId: string | null;
  supplierName: string | null;
  lines: {
    lineId: string;
    itemId: string;
    itemName: string;
    qty: number;
    unitCode: string;
    goodsValue: number;
  }[];
}
interface ItemOpt {
  id: string;
  name: string;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}
interface Catalogue {
  items: ItemOpt[];
  suppliers: { id: string; name: string }[];
}
interface LineDraft {
  lineId: string | null;
  itemId: string;
  qty: string;
  unit: string;
  unitPrice: string;
  /** The price as entered, to the last fraction, until the person types another. */
  exactPrice: string | null;
}

const CatalogueContext = createContext<Catalogue>({ items: [], suppliers: [] });

/** The items and suppliers a correction chooses from, given once for every delivery listed. */
export function CorrectionCatalogue({
  items,
  suppliers,
  children,
}: Catalogue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ items, suppliers }), [items, suppliers]);
  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

/** A price per unit to ten places, without trailing zeros. */
const exact = (n: number) => n.toFixed(10).replace(/\.?0+$/, "");

const small = { minHeight: 28, padding: "0 8px", fontSize: ".75rem" } as const;
const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmtIQD(Math.abs(n));

/**
 * Correct a delivery (0038): its lines (quantity, price, item), its supplier
 * and its date, or reverse it. What the correction would do is shown first,
 * item by item, as the database works it out; nothing is done until it is
 * confirmed. What was entered first is kept, and the correction is a
 * document of its own.
 */
export function ReceiptCorrection({
  receipt,
  correctable,
}: {
  receipt: CorrectableReceipt;
  /**
   * Whether it can be corrected now. One that no longer can (just reversed,
   * or billed) stays mounted, so the answer stays on screen until closed.
   */
  correctable: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState<"correct" | "reverse" | null>(null);
  const catalogue = useContext(CatalogueContext);
  // An item or the supplier taken out of use since stays as it is on the delivery.
  const items = useMemo(() => {
    const extra = new Map<string, ItemOpt>();
    for (const l of receipt.lines) {
      if (!catalogue.items.some((i) => i.id === l.itemId) && !extra.has(l.itemId)) {
        extra.set(l.itemId, {
          id: l.itemId,
          name: l.itemName,
          baseUnit: l.unitCode,
          units: [{ code: l.unitCode, label: l.unitCode, factor: 1 }],
        });
      }
    }
    return [...catalogue.items, ...extra.values()];
  }, [catalogue.items, receipt.lines]);
  const suppliers = useMemo(
    () =>
      receipt.supplierId && !catalogue.suppliers.some((s) => s.id === receipt.supplierId)
        ? [
            ...catalogue.suppliers,
            { id: receipt.supplierId, name: receipt.supplierName ?? receipt.supplierId },
          ]
        : catalogue.suppliers,
    [catalogue.suppliers, receipt.supplierId, receipt.supplierName],
  );
  return (
    <>
      {correctable && (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button style={small} onClick={() => setOpen("correct")}>
            {t("Correct")}
          </button>
          <button style={small} onClick={() => setOpen("reverse")}>
            {t("Reverse")}
          </button>
        </span>
      )}
      {open && (
        <CorrectionDialog
          mode={open}
          receipt={receipt}
          items={items}
          suppliers={suppliers}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function CorrectionDialog({
  mode,
  receipt,
  items,
  suppliers,
  onClose,
}: {
  mode: "correct" | "reverse";
  receipt: CorrectableReceipt;
  items: ItemOpt[];
  suppliers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const op = useOperation();
  const router = useRouter();
  const { t, msg: say, dir } = useT();
  const { on } = arrows(dir);
  const [busy, start] = useTransition();
  const [lines, setLines] = useState<LineDraft[]>(() =>
    receipt.lines.map((l) => ({
      lineId: l.lineId,
      itemId: l.itemId,
      qty: fmtQty(l.qty).replace(/,/g, ""),
      unit: l.unitCode,
      unitPrice: l.qty > 0 ? String(Number((l.goodsValue / l.qty).toFixed(4))) : "0",
      exactPrice: l.qty > 0 ? exact(l.goodsValue / l.qty) : "0",
    })),
  );
  const [supplier, setSupplier] = useState(receipt.supplierId ?? suppliers[0]?.id ?? "");
  const [day, setDay] = useState(receipt.receivedOn);
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<CorrectionPlan | null>(null);
  const [below, setBelow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CorrectionResult | null>(null);
  const itemById = (id: string) => items.find((i) => i.id === id);
  const edit = (f: () => void) => {
    f();
    setPlan(null);
    setBelow(false);
    setError(null);
  };
  const setLine = (idx: number, patch: Partial<LineDraft>) =>
    edit(() => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, ...patch } : x))));
  const input = () => ({
    receiptId: receipt.id,
    supplierId: supplier,
    receivedOn: day,
    lines: lines.map((l) => ({
      lineId: l.lineId,
      itemId: l.itemId,
      qty: normaliseNumber(l.qty),
      unitCode: l.unit,
      unitPrice: l.exactPrice ?? normaliseNumber(l.unitPrice),
    })),
  });

  function check() {
    setError(null);
    start(async () => {
      const r =
        mode === "reverse"
          ? await previewReceiptCorrectionAction({ receiptId: receipt.id, reverse: true })
          : await previewReceiptCorrectionAction(input());
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPlan(r.data);
    });
  }

  function confirm() {
    setError(null);
    start(async () => {
      const r =
        mode === "reverse"
          ? await op.run("reverseReceipt", (key) =>
              reverseReceiptAction({ receiptId: receipt.id, reason, confirm: below }, key),
            )
          : await op.run("correctReceipt", (key) =>
              correctReceiptAction({ ...input(), reason, confirm: below }, key),
            );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(r.data);
      router.refresh();
    });
  }

  const blockedBy =
    plan?.blocked ??
    (plan && plan.countedSince.length > 0
      ? t(
          "{items} counted after this delivery, and the count set its stock: correct only its price",
          {
            items: plan.countedSince.join(", "),
          },
        )
      : null);
  const nothing = plan !== null && plan.kinds.length === 0;
  const kindLabel = (k: string) =>
    ({
      quantity: t("the quantity"),
      price: t("the price"),
      item: t("the item"),
      supplier: t("the supplier"),
      date: t("the date"),
      reversed: t("reversed"),
    })[k] ?? k;

  return (
    <Modal
      label={mode === "reverse" ? t("Reverse the delivery") : t("Correct the delivery")}
      busy={busy}
      onClose={onClose}
    >
      <div data-testid="receipt-correction" style={{ display: "grid", gap: 12, minWidth: 0 }}>
        <h3 style={{ margin: 0 }}>
          {mode === "reverse"
            ? t("Reverse delivery {no}", { no: receipt.receiptNo ?? "—" })
            : t("Correct delivery {no}", { no: receipt.receiptNo ?? "—" })}
        </h3>

        {done ? (
          <>
            <div
              className="badge ok"
              style={{ whiteSpace: "normal" }}
              data-testid="correction-answer"
            >
              {done.reversed
                ? t("Delivery {receipt} reversed (correction {no}).", {
                    receipt: done.receiptNo,
                    no: done.correctionNo,
                  })
                : t("Correction {no} of delivery {receipt}: {what}.", {
                    no: done.correctionNo,
                    receipt: done.receiptNo,
                    what: done.kinds.map(kindLabel).join(", "),
                  })}{" "}
              {done.journalNo !== null
                ? t(
                    "Stock {stock}, owed for it {grni}, price variance {variance} (journal {journal}).",
                    {
                      stock: signed(done.stock),
                      grni: signed(done.grni),
                      variance: signed(done.variance),
                      journal: done.journalNo,
                    },
                  )
                : t("Nothing to post.")}
            </div>
            <div>
              <button onClick={onClose}>{t("pos.close")}</button>
            </div>
          </>
        ) : (
          <>
            {mode === "correct" ? (
              <>
                <p className="muted" style={{ margin: 0, fontSize: ".82rem" }}>
                  {t(
                    "Change what is wrong, as the invoice has it. A line left out is taken off. What was entered first is kept, and the correction is on the audit trail.",
                  )}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ flex: 2, minWidth: 160 }}>
                    <div className="muted" style={{ fontSize: ".78rem" }}>
                      {t("Supplier")}
                    </div>
                    <select
                      aria-label={t("Supplier")}
                      value={supplier}
                      onChange={(e) => edit(() => setSupplier(e.target.value))}
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: 1, minWidth: 140 }}>
                    <div className="muted" style={{ fontSize: ".78rem" }}>
                      {t("The day it came")}
                    </div>
                    <input
                      aria-label={t("The day it came")}
                      type="date"
                      min={receipt.firstDay}
                      max={receipt.lastDay}
                      value={day}
                      onChange={(e) => edit(() => setDay(e.target.value))}
                    />
                  </label>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {lines.map((l, idx) => {
                    const it = itemById(l.itemId);
                    return (
                      <div
                        key={idx}
                        data-testid="correction-line"
                        style={{ display: "flex", gap: 6, alignItems: "end", flexWrap: "wrap" }}
                      >
                        <label style={{ flex: 2, minWidth: 140 }}>
                          <div className="muted" style={{ fontSize: ".75rem" }}>
                            {t("Item")}
                          </div>
                          <select
                            aria-label={t("Item")}
                            value={l.itemId}
                            onChange={(e) =>
                              setLine(idx, {
                                itemId: e.target.value,
                                unit: itemById(e.target.value)?.baseUnit ?? "",
                              })
                            }
                          >
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={{ flex: 1, minWidth: 70 }}>
                          <div className="muted" style={{ fontSize: ".75rem" }}>
                            {t("Quantity")}
                          </div>
                          <input
                            aria-label={t("Quantity of {item}", { item: it?.name ?? "" })}
                            inputMode="decimal"
                            value={l.qty}
                            onChange={(e) => setLine(idx, { qty: e.target.value })}
                          />
                        </label>
                        <label style={{ flex: 1, minWidth: 100 }}>
                          <div className="muted" style={{ fontSize: ".75rem" }}>
                            {t("Unit")}
                          </div>
                          <select
                            aria-label={t("Unit")}
                            value={l.unit}
                            onChange={(e) => setLine(idx, { unit: e.target.value })}
                          >
                            {(it?.units ?? []).map((u) => (
                              <option key={u.code} value={u.code}>
                                {unitName(u.label, t)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={{ flex: 1, minWidth: 100 }}>
                          <div className="muted" style={{ fontSize: ".75rem" }}>
                            {t("Price per unit (IQD)")}
                          </div>
                          <input
                            aria-label={t("Price of {item}", { item: it?.name ?? "" })}
                            inputMode="decimal"
                            value={l.unitPrice}
                            onChange={(e) =>
                              setLine(idx, { unitPrice: e.target.value, exactPrice: null })
                            }
                          />
                        </label>
                        <button
                          aria-label={t("Take the line off")}
                          onClick={() =>
                            edit(() => setLines((ls) => ls.filter((_, i) => i !== idx)))
                          }
                          disabled={lines.length === 1}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  <button
                    style={{ alignSelf: "start" }}
                    onClick={() =>
                      edit(() =>
                        setLines((ls) => [
                          ...ls,
                          {
                            lineId: null,
                            itemId: items[0]?.id ?? "",
                            qty: "",
                            unit: items[0]?.baseUnit ?? "",
                            unitPrice: "",
                            exactPrice: null,
                          },
                        ]),
                      )
                    }
                  >
                    + {t("Add line")}
                  </button>
                </div>
              </>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: ".82rem" }}>
                {t(
                  "For a delivery that should never have been entered: its stock goes out and nothing is owed for it. What was entered is kept, marked reversed.",
                )}
              </p>
            )}

            {plan && !nothing && (
              <div className="tw" data-testid="correction-plan">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Item")}</th>
                      <th className="right">{t("On the delivery")}</th>
                      <th className="right">{t("In stock")}</th>
                      <th className="right">{t("Stock value")}</th>
                      <th className="right">{t("Owed for it (2050)")}</th>
                      <th className="right">{t("Price variance (5050)")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.items.map((e) => (
                      <tr key={e.itemId}>
                        <td>{e.name}</td>
                        <td className="right mono">
                          {fmtQty(e.qtyBefore)} {on} {fmtQty(e.qtyAfter)} {unitName(e.unit, t)}
                        </td>
                        <td className={`right mono ${e.onHandAfter < 0 ? "red" : ""}`}>
                          {fmtQty(e.onHand)} {on} {fmtQty(e.onHandAfter)}
                        </td>
                        <td className="right mono">{signed(e.stockChange)}</td>
                        <td className="right mono">{signed(e.grniChange)}</td>
                        <td className="right mono">{signed(e.variance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {plan && !nothing && (
              <div data-testid="correction-totals" style={{ fontSize: ".85rem" }}>
                {t("Stock {stock} · owed for it {grni} · price variance {variance}", {
                  stock: signed(plan.stock),
                  grni: signed(plan.grni),
                  variance: signed(plan.variance),
                })}
                {plan.variance !== 0 && (
                  <div className="muted" style={{ fontSize: ".78rem" }}>
                    {t(
                      "Part of its stock has been used already, at the price it came in at: that part of the difference goes to purchase price variance (5050).",
                    )}
                  </div>
                )}
              </div>
            )}
            {nothing && <span className="muted">{t("Nothing was changed")}</span>}
            {blockedBy && (
              <span className="red" style={{ fontSize: ".85rem" }}>
                {say(blockedBy)}
              </span>
            )}
            {plan && plan.belowZero.length > 0 && !blockedBy && (
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: ".85rem" }}>
                <input
                  type="checkbox"
                  checked={below}
                  onChange={(e) => setBelow(e.target.checked)}
                />
                {t("This leaves {items} below zero: correct it all the same", {
                  items: plan.belowZero
                    .map((b) => `${b.name} (${fmtQty(b.onHandAfter)} ${unitName(b.unit, t)})`)
                    .join(", "),
                })}
              </label>
            )}
            {plan && !nothing && !blockedBy && (
              <input
                aria-label={t("Why it is corrected")}
                placeholder={
                  mode === "reverse"
                    ? t("Why it is reversed, in a few words")
                    : t("Why it is corrected, in a few words")
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
              />
            )}
            {error && (
              <span className="red" style={{ fontSize: ".85rem" }}>
                {say(error)}
              </span>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!plan || nothing ? (
                <button className="btn-primary" onClick={check} disabled={busy}>
                  {busy ? "…" : t("Show what it would do")}
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={confirm}
                  disabled={
                    busy ||
                    blockedBy !== null ||
                    !reason.trim() ||
                    (plan.belowZero.length > 0 && !below)
                  }
                >
                  {busy
                    ? "…"
                    : mode === "reverse"
                      ? t("Reverse the delivery")
                      : t("Confirm the correction")}
                </button>
              )}
              <button onClick={onClose} disabled={busy}>
                {t("Cancel")}
              </button>
            </div>
            <OperationStatus op={op} />
          </>
        )}
      </div>
    </Modal>
  );
}
