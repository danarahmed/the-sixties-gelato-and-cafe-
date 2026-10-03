"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  approvePurchaseOrderAction,
  cancelPurchaseOrderAction,
  closePurchaseOrderAction,
  savePurchaseOrderAction,
  sendPurchaseOrderAction,
} from "@/lib/actions/purchasing";
import { fmtIQD, fmtQty, packName, unitName } from "@/lib/format";
import {
  inOrderUnit,
  orderStage,
  orderTotal,
  STAGE_LABEL,
  type OrderStage,
  type PurchaseOrder,
} from "@/lib/purchasing";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

export interface OrderItemOpt {
  id: string;
  name: string;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}
export interface OrderSupplierOpt {
  id: string;
  name: string;
}
type Msg = { ok: boolean; text: string } | null;
interface LineDraft {
  itemId: string;
  qty: string;
  unit: string;
  unitPrice: string;
}

const STAGE_BADGE: Record<OrderStage, string> = {
  draft: "badge",
  approved: "badge ok",
  sent: "badge ok",
  part: "badge warn",
  received: "badge ok",
  closed: "badge",
  cancelled: "badge err",
};

/**
 * Purchase orders (0044): drafted by whoever buys, approved by a manager
 * whose limit covers the total, sent to the supplier (printed from its own
 * page), received against on Purchasing, then closed, or cancelled while
 * nothing has come.
 */
export function PurchaseOrders({
  orders,
  approveUpTo,
  items,
  suppliers,
  canCreate,
  canApprove,
}: {
  orders: PurchaseOrder[];
  /** The reader's approval limit; null when they approve none. */
  approveUpTo: number | null;
  items: OrderItemOpt[];
  suppliers: OrderSupplierOpt[];
  canCreate: boolean;
  canApprove: boolean;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState<PurchaseOrder | "new" | null>(null);
  const [saved, setSaved] = useState<Msg>(null);
  const itemName = new Map(items.map((i) => [i.id, i.name]));
  return (
    <div className="card tw" data-testid="po-panel">
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>{t("Purchase orders")}</h3>
        {canCreate && editing === null && (
          <button
            type="button"
            onClick={() => {
              setSaved(null);
              setEditing("new");
            }}
          >
            {t("New order")}
          </button>
        )}
      </div>
      <Notice msg={saved} />
      <p className="muted" style={{ marginTop: 6, fontSize: ".85rem" }}>
        {approveUpTo === null
          ? t(
              "An order is drafted, then approved by a manager whose limit covers its total, sent to the supplier, and received against below. It closes when all has come, or with a reason when the rest is not coming.",
            )
          : t(
              "An order is drafted, then approved by a manager whose limit covers its total — yours is {limit} — sent to the supplier, and received against below. It closes when all has come, or with a reason when the rest is not coming.",
              { limit: fmtIQD(approveUpTo) },
            )}
      </p>
      {editing !== null && (
        <OrderForm
          key={editing === "new" ? "new" : editing.id}
          order={editing === "new" ? null : editing}
          items={items}
          suppliers={suppliers}
          onDone={(m) => {
            setSaved(m);
            setEditing(null);
          }}
        />
      )}
      {orders.length === 0 ? (
        <p className="muted" style={{ fontSize: ".9rem" }}>
          {t("No purchase orders yet.")}
        </p>
      ) : (
        <table data-testid="po-list">
          <thead>
            <tr>
              <th>{t("No.")}</th>
              <th>{t("Supplier")}</th>
              <th>{t("Expected")}</th>
              <th>{t("What has come")}</th>
              <th className="right">{t("Total")}</th>
              <th>{t("Stage")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const stage = orderStage(o);
              return (
                <tr key={o.id} data-testid="po-row" data-po={o.poNo}>
                  <td className="mono">
                    <Link href={`/purchasing/orders/${o.id}`}>{o.poNo}</Link>
                  </td>
                  <td>{o.supplier}</td>
                  <td className="mono muted" style={{ fontSize: ".8rem" }}>
                    {o.expectedOn ?? "—"}
                  </td>
                  <td style={{ fontSize: ".8rem" }}>
                    {o.lines.map((l) => (
                      <div key={l.lineId}>
                        {itemName.get(l.itemId) ?? l.item}{" "}
                        <span className="mono">
                          {fmtQty(inOrderUnit(l, l.receivedBase))}/{fmtQty(l.qty)}{" "}
                          {packName(l.unitCode, items.find((i) => i.id === l.itemId)?.units, t)}
                        </span>
                      </div>
                    ))}
                  </td>
                  <td className="right mono">{fmtIQD(o.total)}</td>
                  <td>
                    <span className={STAGE_BADGE[stage]} data-testid="po-stage">
                      {t(STAGE_LABEL[stage])}
                    </span>
                    {o.approvedBy && o.status !== "draft" && (
                      <div className="muted" style={{ fontSize: ".75rem" }}>
                        {t("Approved by {name}", { name: o.approvedBy })}
                      </div>
                    )}
                    {o.closeReason && (
                      <div className="muted" style={{ fontSize: ".75rem" }}>
                        “{o.closeReason}”
                      </div>
                    )}
                    {o.cancelReason && (
                      <div className="muted" style={{ fontSize: ".75rem" }}>
                        “{o.cancelReason}”
                      </div>
                    )}
                  </td>
                  <td>
                    <OrderActions
                      order={o}
                      canCreate={canCreate}
                      canApprove={canApprove}
                      onEdit={() => {
                        setSaved(null);
                        setEditing(o);
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** A row's buttons, small enough to sit side by side. */
const small = { minHeight: 30, padding: "0 10px", fontSize: ".8rem" } as const;

/** What can be done to an order at its step, by the reader. */
function OrderActions({
  order,
  canCreate,
  canApprove,
  onEdit,
}: {
  order: PurchaseOrder;
  canCreate: boolean;
  canApprove: boolean;
  onEdit: () => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [asking, setAsking] = useState<"close" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const mayAct = canCreate || canApprove;
  const open = order.status === "approved" || order.status === "sent";
  const nothingCame = order.deliveries.length === 0;

  function run(
    name: string,
    send: (
      key: string,
    ) => Promise<{ ok: true; data: { poNo: number } } | { ok: false; error: string }>,
    done: string,
  ) {
    setMsg(null);
    start(async () => {
      const r = await op.run(name, send);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: done });
      setAsking(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {canCreate && (order.status === "draft" || order.status === "approved") && (
          <button type="button" style={small} onClick={onEdit} disabled={busy}>
            {t("Change")}
          </button>
        )}
        {canApprove && order.status === "draft" && order.mayApprove && (
          <button
            type="button"
            className="btn-primary"
            style={small}
            disabled={busy}
            onClick={() =>
              run(
                "approvePo",
                (key) => approvePurchaseOrderAction({ poId: order.id }, key),
                t("Order {no} approved.", { no: order.poNo }),
              )
            }
          >
            {t("Approve")}
          </button>
        )}
        {mayAct && order.status === "approved" && (
          <button
            type="button"
            style={small}
            disabled={busy}
            onClick={() =>
              run(
                "sendPo",
                (key) => sendPurchaseOrderAction({ poId: order.id }, key),
                t("Order {no} marked as sent to the supplier.", { no: order.poNo }),
              )
            }
          >
            {t("Mark as sent")}
          </button>
        )}
        {mayAct && open && !nothingCame && (
          <button type="button" style={small} disabled={busy} onClick={() => setAsking("close")}>
            {t("Close")}
          </button>
        )}
        {mayAct && order.status !== "closed" && order.status !== "cancelled" && nothingCame && (
          <button type="button" style={small} disabled={busy} onClick={() => setAsking("cancel")}>
            {t("Cancel")}
          </button>
        )}
      </div>
      {canApprove && order.status === "draft" && !order.mayApprove && (
        <span className="muted" style={{ fontSize: ".75rem" }}>
          {t("Over your limit: the owner or the general manager approves it")}
        </span>
      )}
      {asking !== null && (
        <form
          className="grid"
          style={{ gap: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (asking === "cancel") {
              run(
                "cancelPo",
                (key) => cancelPurchaseOrderAction({ poId: order.id, reason }, key),
                t("Order {no} cancelled.", { no: order.poNo }),
              );
            } else {
              run(
                "closePo",
                (key) => closePurchaseOrderAction({ poId: order.id, reason }, key),
                t("Order {no} closed.", { no: order.poNo }),
              );
            }
          }}
        >
          <input
            aria-label={
              asking === "cancel" ? t("Why cancel it?") : t("Why is the rest not coming?")
            }
            placeholder={
              asking === "cancel"
                ? t("Why cancel it?")
                : order.receiving === "all"
                  ? t("A note (optional)")
                  : t("Why is the rest not coming?")
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn-primary" type="submit" disabled={busy}>
              {asking === "cancel" ? t("Cancel the order") : t("Close the order")}
            </button>
            <button type="button" onClick={() => setAsking(null)} disabled={busy}>
              {t("Keep it")}
            </button>
          </div>
        </form>
      )}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

const blankLine = (): LineDraft => ({ itemId: "", qty: "", unit: "", unitPrice: "" });

/** A new order, or a draft (or an approved order, which goes back to being a draft) changed. */
function OrderForm({
  order,
  items,
  suppliers,
  onDone,
}: {
  order: PurchaseOrder | null;
  items: OrderItemOpt[];
  suppliers: OrderSupplierOpt[];
  onDone: (saved: Msg) => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [supplierId, setSupplierId] = useState(order?.supplierId ?? "");
  const [expectedOn, setExpectedOn] = useState(order?.expectedOn ?? "");
  const [note, setNote] = useState(order?.note ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    order
      ? order.lines.map((l) => ({
          itemId: l.itemId,
          qty: String(l.qty),
          unit: l.unitCode,
          unitPrice: String(l.unitPrice),
        }))
      : [blankLine()],
  );
  const byId = new Map(items.map((i) => [i.id, i]));
  const typed = lines.map((l) => ({
    qty: Number(normaliseNumber(l.qty)) || 0,
    unitPrice: Number(normaliseNumber(l.unitPrice)) || 0,
  }));
  const total = orderTotal(typed);
  const ready =
    !busy &&
    supplierId !== "" &&
    lines.length > 0 &&
    lines.every((l, i) => l.itemId !== "" && (typed[i]?.qty ?? 0) > 0 && l.unitPrice.trim() !== "");

  const set = (i: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function submit() {
    if (!ready) return;
    setMsg(null);
    start(async () => {
      const r = await op.run("savePo", (key) =>
        savePurchaseOrderAction(
          {
            poId: order?.id ?? null,
            supplierId,
            expectedOn: expectedOn || null,
            note,
            lines: lines.map((l) => ({
              itemId: l.itemId,
              qty: normaliseNumber(l.qty),
              unitCode: l.unit || (byId.get(l.itemId)?.baseUnit ?? ""),
              unitPrice: normaliseNumber(l.unitPrice),
            })),
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
      onDone({
        ok: true,
        text: t("Order {no} saved as a draft: {total}. A manager approves it next.", {
          no: r.data.poNo,
          total: fmtIQD(r.data.total),
        }),
      });
    });
  }

  return (
    <form
      className="grid"
      data-testid="po-form"
      style={{
        gap: 10,
        margin: "10px 0 16px",
        paddingBlock: 10,
        borderBlock: "1px solid var(--border)",
      }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <strong>
        {order
          ? order.status === "approved"
            ? t("Order {no}: changed, it is a draft again and is approved again", {
                no: order.poNo,
              })
            : t("Order {no}", { no: order.poNo })
          : t("A new order")}
      </strong>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={{ minWidth: 200 }}>
          <div className="sc">{t("Supplier")}</div>
          <select
            aria-label={t("Supplier")}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">{t("Choose…")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="sc">{t("Expected")}</div>
          <input
            type="date"
            aria-label={t("Expected")}
            value={expectedOn}
            onChange={(e) => setExpectedOn(e.target.value)}
          />
        </label>
        <label style={{ flex: 1, minWidth: 200 }}>
          <div className="sc">{t("Note for the supplier")}</div>
          <input
            aria-label={t("Note for the supplier")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      <table>
        <thead>
          <tr>
            <th>{t("Item")}</th>
            <th className="right">{t("Quantity")}</th>
            <th>{t("Unit")}</th>
            <th className="right">{t("Price per unit")}</th>
            <th className="right">{t("Amount")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const it = byId.get(l.itemId);
            return (
              <tr key={i} data-testid="po-line">
                <td>
                  <select
                    aria-label={t("Item")}
                    value={l.itemId}
                    onChange={(e) =>
                      set(i, {
                        itemId: e.target.value,
                        unit: byId.get(e.target.value)?.baseUnit ?? "",
                      })
                    }
                  >
                    <option value="">{t("Choose…")}</option>
                    {items.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="right">
                  <input
                    aria-label={t("Quantity")}
                    className="amt"
                    inputMode="decimal"
                    style={{ width: 90, textAlign: "end" }}
                    value={l.qty}
                    onChange={(e) => set(i, { qty: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label={t("Unit")}
                    value={l.unit || it?.baseUnit || ""}
                    onChange={(e) => set(i, { unit: e.target.value })}
                    disabled={!it}
                  >
                    {it && <option value={it.baseUnit}>{unitName(it.baseUnit, t)}</option>}
                    {it?.units
                      .filter((u) => u.code !== it.baseUnit)
                      .map((u) => (
                        <option key={u.code} value={u.code}>
                          {unitName(u.label, t)}
                        </option>
                      ))}
                  </select>
                </td>
                <td className="right">
                  <input
                    aria-label={t("Price per unit")}
                    className="amt"
                    inputMode="decimal"
                    style={{ width: 110, textAlign: "end" }}
                    value={l.unitPrice}
                    onChange={(e) => set(i, { unitPrice: e.target.value })}
                  />
                </td>
                <td className="right mono">
                  {fmtIQD(orderTotal([typed[i] ?? { qty: 0, unitPrice: 0 }]))}
                </td>
                <td>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      aria-label={t("Remove the line")}
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])}>
          {t("Add a line")}
        </button>
        <span style={{ marginInlineStart: "auto" }}>
          {t("Total")}:{" "}
          <strong className="mono" data-testid="po-total">
            {fmtIQD(total)}
          </strong>
        </span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-primary" type="submit" disabled={!ready}>
          {busy ? t("Saving…") : t("Save the draft")}
        </button>
        <button type="button" onClick={() => onDone(null)} disabled={busy}>
          {t("Back")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </form>
  );
}
