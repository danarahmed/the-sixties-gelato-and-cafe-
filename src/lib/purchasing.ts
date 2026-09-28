/**
 * Purchasing (0044, release S), as the screens handle it: purchase orders and
 * how far each has come, a delivery pre-filled from its order, returns to a
 * supplier, the suppliers' credits, the statement and the report. Pure: the
 * screens and the tests read through here. The database checks and works out
 * every figure again, and its answer is the one recorded.
 */
import Decimal from "decimal.js";

export type PoStatus = "draft" | "approved" | "sent" | "closed" | "cancelled";
/** How much of an order has come: nothing, some of it, all of it. */
export type Receiving = "none" | "part" | "all";
/** An order's step, as the screens name it: its status, and while open, what has come. */
export type OrderStage =
  "draft" | "approved" | "sent" | "part" | "received" | "closed" | "cancelled";

export interface PoLine {
  lineId: string;
  lineNo: number;
  itemId: string;
  item: string;
  qty: number;
  unitCode: string;
  unitPrice: number;
  amount: number;
  /** The quantity ordered, in the item's base unit. */
  baseQty: number;
  baseUnit: string;
  /** What has come of it so far, in the base unit (the deliveries as they stand now). */
  receivedBase: number;
  outstandingBase: number;
}

export interface PurchaseOrder {
  id: string;
  poNo: number;
  status: PoStatus;
  receiving: Receiving;
  supplierId: string;
  supplier: string;
  locationId: string;
  location: string;
  expectedOn: string | null;
  note: string | null;
  total: number;
  createdAt: string;
  createdBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  sentAt: string | null;
  sentBy: string | null;
  closedAt: string | null;
  closedBy: string | null;
  closeReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  lines: PoLine[];
  /** What came against it that was not on it. */
  unexpected: { itemId: string; item: string; baseQty: number; baseUnit: string }[];
  deliveries: { receiptId: string; receiptNo: number | null; receivedAt: string }[];
  /** The reader may approve it: a draft, within their limit. */
  mayApprove: boolean;
}

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

const STATUSES: readonly PoStatus[] = ["draft", "approved", "sent", "closed", "cancelled"];
const RECEIVING: readonly Receiving[] = ["none", "part", "all"];

export function purchaseOrderFrom(r: Record<string, unknown>): PurchaseOrder {
  const status = STATUSES.includes(r.status as PoStatus) ? (r.status as PoStatus) : "draft";
  const receiving = RECEIVING.includes(r.receiving as Receiving)
    ? (r.receiving as Receiving)
    : "none";
  return {
    id: str(r.id),
    poNo: num(r.po_no),
    status,
    receiving,
    supplierId: str(r.supplier_id),
    supplier: str(r.supplier),
    locationId: str(r.location_id),
    location: str(r.location),
    expectedOn: strOrNull(r.expected_on),
    note: strOrNull(r.note),
    total: num(r.total),
    createdAt: str(r.created_at),
    createdBy: strOrNull(r.created_by),
    approvedAt: strOrNull(r.approved_at),
    approvedBy: strOrNull(r.approved_by),
    sentAt: strOrNull(r.sent_at),
    sentBy: strOrNull(r.sent_by),
    closedAt: strOrNull(r.closed_at),
    closedBy: strOrNull(r.closed_by),
    closeReason: strOrNull(r.close_reason),
    cancelledAt: strOrNull(r.cancelled_at),
    cancelledBy: strOrNull(r.cancelled_by),
    cancelReason: strOrNull(r.cancel_reason),
    lines: list(r.lines).map((l) => ({
      lineId: str(l.line_id),
      lineNo: num(l.line_no),
      itemId: str(l.item_id),
      item: str(l.item),
      qty: num(l.qty),
      unitCode: str(l.unit_code),
      unitPrice: num(l.unit_price),
      amount: num(l.amount),
      baseQty: num(l.base_qty),
      baseUnit: str(l.base_unit),
      receivedBase: num(l.received_base),
      outstandingBase: num(l.outstanding_base),
    })),
    unexpected: list(r.unexpected).map((u) => ({
      itemId: str(u.item_id),
      item: str(u.item),
      baseQty: num(u.base_qty),
      baseUnit: str(u.base_unit),
    })),
    deliveries: list(r.deliveries).map((d) => ({
      receiptId: str(d.receipt_id),
      receiptNo: numOrNull(d.receipt_no),
      receivedAt: str(d.received_at),
    })),
    mayApprove: r.may_approve === true,
  };
}

/** The orders as purchase_orders() gives them, and the reader's approval limit. */
export function purchaseOrdersFrom(r: Record<string, unknown> | null | undefined): {
  approveUpTo: number | null;
  orders: PurchaseOrder[];
} {
  const d = r ?? {};
  return { approveUpTo: numOrNull(d.approve_up_to), orders: list(d.orders).map(purchaseOrderFrom) };
}

export function orderStage(o: Pick<PurchaseOrder, "status" | "receiving">): OrderStage {
  if (o.status === "approved" || o.status === "sent") {
    if (o.receiving === "all") return "received";
    if (o.receiving === "part") return "part";
  }
  return o.status;
}

/** Each step's name: a phrase, shown through t(). */
export const STAGE_LABEL: Record<OrderStage, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  part: "Partly received",
  received: "Received",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** An order is open while it is approved or sent: deliveries come against it. */
export const isOpen = (o: Pick<PurchaseOrder, "status">): boolean =>
  o.status === "approved" || o.status === "sent";

/** A quantity in the base unit, in the unit a line was ordered in. */
export function inOrderUnit(line: Pick<PoLine, "qty" | "baseQty">, base: number): number {
  if (line.baseQty <= 0) return 0;
  return new Decimal(base).times(line.qty).dividedBy(line.baseQty).toDecimalPlaces(3).toNumber();
}

/** A delivery against an order, pre-filled: each line still to come, in its unit, at its price. */
export function prefillFromOrder(o: Pick<PurchaseOrder, "lines">): {
  poLineId: string;
  itemId: string;
  qty: number;
  unitCode: string;
  unitPrice: number;
}[] {
  return o.lines
    .filter((l) => l.outstandingBase > 0)
    .map((l) => ({
      poLineId: l.lineId,
      itemId: l.itemId,
      qty: inOrderUnit(l, l.outstandingBase),
      unitCode: l.unitCode,
      unitPrice: l.unitPrice,
    }));
}

/** How a line being received differs from its order, for the form to show. */
export type Difference =
  | { kind: "more"; ordered: number; coming: number }
  | { kind: "less"; ordered: number; coming: number }
  | { kind: "price"; ordered: number; now: number }
  | { kind: "unexpected" };

/**
 * A delivery line against its order line (by item): more or less than is
 * still to come, a price other than the order's, or an item not on the order.
 * Quantities are in the order line's unit when the line is in it; otherwise
 * the database's check, in base units, is the one that counts.
 */
export function differences(
  o: Pick<PurchaseOrder, "lines">,
  line: { itemId: string; qty: number; unitCode: string; unitPrice: number },
): Difference[] {
  const ordered = o.lines.find((l) => l.itemId === line.itemId);
  if (!ordered) return [{ kind: "unexpected" }];
  const out: Difference[] = [];
  if (line.unitCode === ordered.unitCode) {
    const still = inOrderUnit(ordered, ordered.outstandingBase);
    if (line.qty > still) out.push({ kind: "more", ordered: still, coming: line.qty });
    else if (line.qty < still) out.push({ kind: "less", ordered: still, coming: line.qty });
    if (line.unitPrice !== ordered.unitPrice) {
      out.push({ kind: "price", ordered: ordered.unitPrice, now: line.unitPrice });
    }
  }
  return out;
}

/**
 * An order's total as the database works it out: each line's quantity times
 * its price, rounded to the dinar (half to even), then added up.
 */
export function orderTotal(lines: { qty: number; unitPrice: number }[]): number {
  return lines
    .reduce(
      (t, l) =>
        t.plus(
          new Decimal(l.qty || 0)
            .times(l.unitPrice || 0)
            .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN),
        ),
      new Decimal(0),
    )
    .toNumber();
}

/** How the database begins its answer when a delivery only needs confirming. */
export const CONFIRM_PREFIXES = [
  "Check the price:",
  "Check the quantity:",
  "Check the price and the quantity:",
] as const;

/** Whether a refused delivery only needs the person to confirm it: a price far off, more than ordered. */
export function needsDeliveryConfirmation(error: string): boolean {
  return CONFIRM_PREFIXES.some((p) => error.startsWith(p));
}

/* --------------------------------------------------------------- credits */

export type CreditKind = "goods_return" | "price" | "other";

/** Each kind of credit: a phrase, shown through t(). */
export const CREDIT_KIND_LABEL: Record<CreditKind, string> = {
  goods_return: "Goods returned",
  price: "A lower price",
  other: "Other",
};

export interface SupplierCredit {
  id: string;
  creditNo: number;
  supplierId: string;
  kind: CreditKind;
  amount: number;
  creditDate: string;
  /** The number on the supplier's credit note; null while a return's credit waits for it. */
  supplierRef: string | null;
  reason: string;
  receiptNo: number | null;
  returnNo: number | null;
  billNo: string | null;
  accountCode: string | null;
  /** What has been set against bills, and what is left. */
  setAgainst: number;
  left: number;
}

/* --------------------------------------------------------------- the statement */

export type StatementKind = "bill" | "cancelled" | "payment" | "credit";

export interface StatementLine {
  date: string;
  kind: StatementKind;
  id: string;
  /** The bill's number, or the supplier's credit note's. */
  ref: string | null;
  note: string | null;
  charge: number;
  credit: number;
  balance: number;
  due: string | null;
  receiptNo: number | null;
  method: string | null;
  bill: string | null;
  creditNo: number | null;
  creditKind: CreditKind | null;
  returnNo: number | null;
}

export interface SupplierStatement {
  supplier: { id: string; name: string; contact: string | null; phone: string | null };
  from: string;
  to: string;
  opening: number;
  lines: StatementLine[];
  closing: number;
  billed: number;
  cancelled: number;
  paid: number;
  credited: number;
  openBills: {
    billId: string;
    invoiceNo: string;
    date: string;
    due: string | null;
    total: number;
    paid: number;
    credited: number;
    outstanding: number;
    daysOverdue: number;
  }[];
  openCredits: {
    creditId: string;
    creditNo: number;
    date: string;
    kind: CreditKind;
    supplierRef: string | null;
    amount: number;
    left: number;
  }[];
}

const kindOf = (v: unknown): CreditKind =>
  v === "goods_return" || v === "price" || v === "other" ? v : "other";

export function statementFrom(r: Record<string, unknown> | null | undefined): SupplierStatement {
  const d = r ?? {};
  const s = (d.supplier ?? {}) as Record<string, unknown>;
  return {
    supplier: {
      id: str(s.id),
      name: str(s.name),
      contact: strOrNull(s.contact),
      phone: strOrNull(s.phone),
    },
    from: str(d.from),
    to: str(d.to),
    opening: num(d.opening),
    lines: list(d.lines).map((l) => ({
      date: str(l.date),
      kind: (["bill", "cancelled", "payment", "credit"] as const).includes(l.kind as StatementKind)
        ? (l.kind as StatementKind)
        : "bill",
      id: str(l.id),
      ref: strOrNull(l.ref),
      note: strOrNull(l.note),
      charge: num(l.charge),
      credit: num(l.credit),
      balance: num(l.balance),
      due: strOrNull(l.due),
      receiptNo: numOrNull(l.receipt_no),
      method: strOrNull(l.method),
      bill: strOrNull(l.bill),
      creditNo: numOrNull(l.credit_no),
      creditKind: l.credit_kind == null ? null : kindOf(l.credit_kind),
      returnNo: numOrNull(l.return_no),
    })),
    closing: num(d.closing),
    billed: num(d.billed),
    cancelled: num(d.cancelled),
    paid: num(d.paid),
    credited: num(d.credited),
    openBills: list(d.open_bills).map((b) => ({
      billId: str(b.bill_id),
      invoiceNo: str(b.invoice_no),
      date: str(b.date),
      due: strOrNull(b.due),
      total: num(b.total),
      paid: num(b.paid),
      credited: num(b.credited),
      outstanding: num(b.outstanding),
      daysOverdue: num(b.days_overdue),
    })),
    openCredits: list(d.open_credits).map((c) => ({
      creditId: str(c.credit_id),
      creditNo: num(c.credit_no),
      date: str(c.date),
      kind: kindOf(c.kind),
      supplierRef: strOrNull(c.supplier_ref),
      amount: num(c.amount),
      left: num(c.left),
    })),
  };
}

/* --------------------------------------------------------------- the report */

export interface PurchasingReport {
  from: string;
  to: string;
  orders: {
    poId: string;
    poNo: number;
    status: PoStatus;
    receiving: Receiving;
    supplier: string;
    ordered: number;
    received: number;
    createdAt: string;
  }[];
  open: PurchaseOrder[];
  priceChanges: {
    receiptNo: number | null;
    receivedAt: string;
    supplier: string;
    item: string;
    unit: string;
    before: number;
    now: number;
    changePercent: number;
  }[];
  returns: {
    returnId: string;
    returnNo: number;
    at: string;
    supplier: string;
    receiptNo: number | null;
    reason: string;
    value: number;
    stockValue: number;
    against: "delivery" | "account";
    creditNo: number | null;
    lines: { item: string; qty: number; unitCode: string; value: number }[];
  }[];
  credits: {
    creditId: string;
    creditNo: number;
    date: string;
    supplier: string;
    kind: CreditKind;
    supplierRef: string | null;
    reason: string;
    amount: number;
    setAgainst: number;
    left: number;
  }[];
  totals: { returned: number; credited: number; creditsLeft: number };
}

export function purchasingReportFrom(
  r: Record<string, unknown> | null | undefined,
): PurchasingReport {
  const d = r ?? {};
  const t = (d.totals ?? {}) as Record<string, unknown>;
  return {
    from: str(d.from),
    to: str(d.to),
    orders: list(d.orders).map((o) => ({
      poId: str(o.po_id),
      poNo: num(o.po_no),
      status: STATUSES.includes(o.status as PoStatus) ? (o.status as PoStatus) : "draft",
      receiving: RECEIVING.includes(o.receiving as Receiving) ? (o.receiving as Receiving) : "none",
      supplier: str(o.supplier),
      ordered: num(o.ordered),
      received: num(o.received),
      createdAt: str(o.created_at),
    })),
    open: list(d.open).map(purchaseOrderFrom),
    priceChanges: list(d.price_changes).map((p) => ({
      receiptNo: numOrNull(p.receipt_no),
      receivedAt: str(p.received_at),
      supplier: str(p.supplier),
      item: str(p.item),
      unit: str(p.unit),
      before: num(p.before),
      now: num(p.now),
      changePercent: num(p.change_percent),
    })),
    returns: list(d.returns).map((x) => ({
      returnId: str(x.return_id),
      returnNo: num(x.return_no),
      at: str(x.at),
      supplier: str(x.supplier),
      receiptNo: numOrNull(x.receipt_no),
      reason: str(x.reason),
      value: num(x.value),
      stockValue: num(x.stock_value),
      against: x.against === "delivery" ? "delivery" : "account",
      creditNo: numOrNull(x.credit_no),
      lines: list(x.lines).map((l) => ({
        item: str(l.item),
        qty: num(l.qty),
        unitCode: str(l.unit_code),
        value: num(l.value),
      })),
    })),
    credits: list(d.credits).map((c) => ({
      creditId: str(c.credit_id),
      creditNo: num(c.credit_no),
      date: str(c.date),
      supplier: str(c.supplier),
      kind: kindOf(c.kind),
      supplierRef: strOrNull(c.supplier_ref),
      reason: str(c.reason),
      amount: num(c.amount),
      setAgainst: num(c.set_against),
      left: num(c.left),
    })),
    totals: {
      returned: num(t.returned),
      credited: num(t.credited),
      creditsLeft: num(t.credits_left),
    },
  };
}

/** Every phrase above, for the check that each is in every language. */
export const PURCHASING_PHRASES: readonly string[] = [
  ...Object.values(STAGE_LABEL),
  ...Object.values(CREDIT_KIND_LABEL),
];
