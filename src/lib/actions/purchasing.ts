"use server";
/**
 * Purchase to pay: receipt → bill → payment (audit C-05). A receipt brings
 * stock in against Goods received not invoiced (2050); the supplier's bill
 * clears GRNI and raises the payable, with any price difference to 5050; a
 * payment settles the payable from the till, the safe, the bank, a card or
 * the owner personally.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import {
  day,
  id,
  nonNegative,
  optionalText,
  paymentSource,
  positive,
  text,
} from "@/lib/validation";

const BUY_PATHS = ["/purchasing", "/vendors", "/inventory", "/reports", "/journals", "/dashboard"];

const supplierInput = z.object({
  name: text("Name", 120),
  contact: optionalText(120),
  phone: optionalText(40),
});

/** A new supplier, its name unlike any other supplier in use (0027). */
export async function createSupplierAction(
  input: z.input<typeof supplierInput>,
  key: string,
): Promise<ActionResult<{ id: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(supplierInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("create_supplier", {
    p_name: v.data.name,
    p_contact: v.data.contact,
    p_phone: v.data.phone,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/purchasing", "/vendors");
  return { ok: true, data: { id: String(r.data) } };
}

const updateSupplierInput = supplierInput.extend({
  supplierId: id("the supplier"),
  isActive: z.boolean(),
  reason: optionalText(300),
  /** Days a delivery takes (0029), for "running out"; null: the café's default. */
  leadTimeDays: z
    .number()
    .int("Days a delivery takes: a whole number")
    .min(0, "A delivery takes 0 to 30 days")
    .max(30, "A delivery takes 0 to 30 days")
    .nullable()
    .optional(),
});

/**
 * A supplier corrected (0027, the audit's P1-4): name, what they supply, phone,
 * whether they are in use, and how many days a delivery takes (0029). Not
 * taken out of use while they are owed money. On the audit trail, with the
 * values before and after.
 */
export async function updateSupplierAction(
  input: z.input<typeof updateSupplierInput>,
): Promise<ActionResult<null>> {
  const v = parse(updateSupplierInput, input);
  if (!v.ok) return v;
  const r = await callRpc("update_supplier", {
    p_supplier: v.data.supplierId,
    p_name: v.data.name,
    p_contact: v.data.contact,
    p_phone: v.data.phone,
    p_is_active: v.data.isActive,
    p_reason: v.data.reason,
    p_lead_time_days: v.data.leadTimeDays ?? null,
  });
  if (!r.ok) return r;
  refresh("/purchasing", "/vendors");
  return { ok: true, data: null };
}

const receiveInput = z.object({
  supplierId: id("the supplier"),
  freight: nonNegative("Freight"),
  other: nonNegative("Other costs"),
  rebate: nonNegative("Rebate"),
  note: optionalText(300),
  lines: z
    .array(
      z.object({
        itemId: id("an item"),
        qty: positive("Quantity"),
        unitCode: z.string().min(1, "Choose a unit"),
        /** The price of one of the unit received, as the invoice gives it (0027). */
        unitPrice: nonNegative("Price per unit"),
      }),
    )
    .min(1, "Add at least one line"),
  /** The person has seen a price far from the item's cost now, and says it is right. */
  confirm: z.boolean().default(false),
});

/**
 * Goods received, each line at its price per unit times the quantity (0027,
 * the audit's P1-3). A line more than 25% away from what the item costs now is
 * refused with the reason, so "2.5 or 50?" is asked before the stock is
 * costed; received again with `confirm`, it goes in, and the confirmation is on
 * the audit trail.
 */
export async function receiveGoodsAction(
  input: z.input<typeof receiveInput>,
  key: string,
): Promise<ActionResult<{ receiptNo: number; value: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(receiveInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("receive_goods", {
    p_supplier: v.data.supplierId,
    p_lines: v.data.lines.map((l) => ({
      item_id: l.itemId,
      qty: l.qty,
      unit_code: l.unitCode,
      unit_price: l.unitPrice,
    })),
    p_freight: v.data.freight,
    p_other: v.data.other,
    p_rebate: v.data.rebate,
    p_note: v.data.note,
    p_confirm: v.data.confirm,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BUY_PATHS);
  return {
    ok: true,
    data: { receiptNo: Number(r.data.receipt_no), value: Number(r.data.value ?? 0) },
  };
}

/** What a correction does to one item (0038), as the database works it out. */
export interface CorrectionEffect {
  itemId: string;
  name: string;
  unit: string;
  qtyBefore: number;
  qtyAfter: number;
  onHand: number;
  onHandAfter: number;
  stockValue: number;
  stockValueAfter: number;
  /** How much of the delivery's value is still on the shelf, 0 to 1. */
  stillOnHand: number;
  stockChange: number;
  grniChange: number;
  variance: number;
}

export interface CorrectionPlan {
  items: CorrectionEffect[];
  stock: number;
  grni: number;
  variance: number;
  kinds: string[];
  belowZero: { name: string; onHandAfter: number; unit: string }[];
  countedSince: string[];
  /** Why the delivery cannot be corrected at all, if it cannot. */
  blocked: string | null;
}

export interface CorrectionResult {
  correctionNo: number;
  receiptNo: number;
  kinds: string[];
  reversed: boolean;
  stock: number;
  grni: number;
  variance: number;
  journalNo: number | null;
  replayed: boolean;
}

const effects = (raw: unknown): CorrectionEffect[] =>
  Array.isArray(raw)
    ? (raw as Record<string, unknown>[]).map((e) => ({
        itemId: String(e.item_id),
        name: String(e.name ?? ""),
        unit: String(e.unit ?? ""),
        qtyBefore: Number(e.qty_before ?? 0),
        qtyAfter: Number(e.qty_after ?? 0),
        onHand: Number(e.on_hand ?? 0),
        onHandAfter: Number(e.on_hand_after ?? 0),
        stockValue: Number(e.stock_value ?? 0),
        stockValueAfter: Number(e.stock_value_after ?? 0),
        stillOnHand: Number(e.still_on_hand ?? 0),
        stockChange: Number(e.stock_change ?? 0),
        grniChange: Number(e.grni_change ?? 0),
        variance: Number(e.variance ?? 0),
      }))
    : [];

const correctionLines = z
  .array(
    z.object({
      /** The delivery's own line, or none for a line added. */
      lineId: z.string().uuid().nullable(),
      itemId: id("an item"),
      qty: positive("Quantity"),
      unitCode: z.string().min(1, "Choose a unit"),
      unitPrice: nonNegative("Price per unit"),
    }),
  )
  .min(1, "A delivery keeps at least one line: to undo all of it, reverse it");

const correctionInput = z.object({
  receiptId: id("a delivery"),
  lines: correctionLines,
  supplierId: id("the supplier"),
  receivedOn: day("The date it came"),
});

// As parse() types what it checked: the numbers, as exact strings, are typed as they came.
const toLines = (lines: z.input<typeof correctionLines>) =>
  lines.map((l) => ({
    line_id: l.lineId,
    item_id: l.itemId,
    qty: l.qty,
    unit_code: l.unitCode,
    unit_price: l.unitPrice,
  }));

const toPlan = (d: Record<string, unknown>): CorrectionPlan => ({
  items: effects(d.items),
  stock: Number(d.stock ?? 0),
  grni: Number(d.grni ?? 0),
  variance: Number(d.variance ?? 0),
  kinds: Array.isArray(d.kinds) ? (d.kinds as unknown[]).map(String) : [],
  belowZero: Array.isArray(d.below_zero)
    ? (d.below_zero as Record<string, unknown>[]).map((b) => ({
        name: String(b.name ?? ""),
        onHandAfter: Number(b.on_hand_after ?? 0),
        unit: String(b.unit ?? ""),
      }))
    : [],
  countedSince: Array.isArray(d.counted_since)
    ? (d.counted_since as Record<string, unknown>[]).map((c) => String(c.name ?? ""))
    : [],
  blocked: d.blocked == null ? null : String(d.blocked),
});

const toResult = (d: Record<string, unknown>): CorrectionResult => ({
  correctionNo: Number(d.correction_no ?? 0),
  receiptNo: Number(d.receipt_no ?? 0),
  kinds: Array.isArray(d.kinds) ? (d.kinds as unknown[]).map(String) : [],
  reversed: Boolean(d.reversed),
  stock: Number(d.stock ?? 0),
  grni: Number(d.grni ?? 0),
  variance: Number(d.variance ?? 0),
  journalNo: d.journal_no == null ? null : Number(d.journal_no),
  replayed: Boolean(d.replayed),
});

/**
 * What correcting a delivery would do (0038), before anything is done: item by
 * item, the stock and its value, what is owed for it (2050) and what goes to
 * purchase price variance (5050). With `reverse`, what reversing it would do.
 */
export async function previewReceiptCorrectionAction(
  input: z.input<typeof correctionInput> | { receiptId: string; reverse: true },
): Promise<ActionResult<CorrectionPlan>> {
  if ("reverse" in input) {
    const v = parse(z.object({ receiptId: id("a delivery") }), input);
    if (!v.ok) return v;
    const r = await callRpc<Record<string, unknown>>("preview_receipt_correction", {
      p_receipt: v.data.receiptId,
      p_reverse: true,
    });
    if (!r.ok) return r;
    return { ok: true, data: toPlan(r.data) };
  }
  const v = parse(correctionInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("preview_receipt_correction", {
    p_receipt: v.data.receiptId,
    p_lines: toLines(v.data.lines),
    p_supplier: v.data.supplierId,
    p_received_on: v.data.receivedOn,
  });
  if (!r.ok) return r;
  return { ok: true, data: toPlan(r.data) };
}

const correctInput = correctionInput.extend({
  reason: text("Why it is corrected", 300),
  /** The person has seen that it leaves stock below zero, and says it is right. */
  confirm: z.boolean().default(false),
});

/** Correct a delivery (0038): its lines, its supplier, its date. Keyed (0035). */
export async function correctReceiptAction(
  input: z.input<typeof correctInput>,
  key: string,
): Promise<ActionResult<CorrectionResult>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(correctInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("correct_receipt", {
    p_receipt: v.data.receiptId,
    p_lines: toLines(v.data.lines),
    p_supplier: v.data.supplierId,
    p_received_on: v.data.receivedOn,
    p_reason: v.data.reason,
    p_confirm: v.data.confirm,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BUY_PATHS);
  return { ok: true, data: toResult(r.data) };
}

const reverseInput = z.object({
  receiptId: id("a delivery"),
  reason: text("Why it is reversed", 300),
  confirm: z.boolean().default(false),
});

/** Reverse a delivery that should not exist (0038). Keyed (0035). */
export async function reverseReceiptAction(
  input: z.input<typeof reverseInput>,
  key: string,
): Promise<ActionResult<CorrectionResult>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(reverseInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("reverse_receipt", {
    p_receipt: v.data.receiptId,
    p_reason: v.data.reason,
    p_confirm: v.data.confirm,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BUY_PATHS);
  return { ok: true, data: toResult(r.data) };
}

const billInput = z
  .object({
    supplierId: id("the vendor"),
    // Empty: the bill takes the café's own number (SGC-2026-0001 …).
    invoiceNo: optionalText(60),
    invoiceDate: day("The invoice date"),
    amount: positive("The amount"),
    termDays: z.coerce.number().int().min(0).max(365),
    receiptId: z.string().uuid().nullable(),
    accountCode: z
      .string()
      .regex(/^\d{4}$/)
      .nullable(),
  })
  .refine((b) => (b.receiptId === null) !== (b.accountCode === null), {
    message: "A bill is either for a goods receipt or for an expense account — choose one",
  });

export async function recordBillAction(
  input: z.input<typeof billInput>,
  key: string,
): Promise<ActionResult<{ invoiceNo: string; journalNo: number | null; priceVariance: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(billInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("record_bill", {
    p_supplier: v.data.supplierId,
    p_invoice_no: v.data.invoiceNo,
    p_invoice_date: v.data.invoiceDate,
    p_amount: v.data.amount,
    p_term_days: v.data.termDays,
    p_receipt: v.data.receiptId,
    p_account_code: v.data.accountCode,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BUY_PATHS, "/expenses");
  return {
    ok: true,
    data: {
      invoiceNo: String(r.data.invoice_no ?? ""),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
      priceVariance: Number(r.data.price_variance ?? 0),
    },
  };
}

const payInput = z.object({
  billId: id("a bill"),
  amount: positive("The amount"),
  method: paymentSource,
});

export async function payBillAction(
  input: z.input<typeof payInput>,
  key: string,
): Promise<ActionResult<{ outstanding: number; journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(payInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("pay_bill", {
    p_bill: v.data.billId,
    p_amount: v.data.amount,
    p_method: v.data.method,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/sales", ...BUY_PATHS);
  return {
    ok: true,
    data: {
      outstanding: Number(r.data.outstanding ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

const cancelInput = z.object({
  billId: id("a bill"),
  reason: text("A reason", 300),
  date: day("The date"),
});

/** A bill entered in error: kept on record, its journal reversed, no longer owed. */
export async function cancelBillAction(
  input: z.input<typeof cancelInput>,
  key: string,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("cancel_bill", {
    p_bill: v.data.billId,
    p_reason: v.data.reason,
    p_date: v.data.date,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BUY_PATHS);
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}
