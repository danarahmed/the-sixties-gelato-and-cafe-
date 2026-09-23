"use server";
/**
 * Purchase to pay: receipt → bill → payment (audit C-05). A receipt brings
 * stock in against Goods received not invoiced (2050); the supplier's bill
 * clears GRNI and raises the payable, with any price difference to 5050; a
 * payment settles the payable from cash, card or bank.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day, id, nonNegative, optionalText, positive, text } from "@/lib/validation";

const BUY_PATHS = ["/purchasing", "/vendors", "/inventory", "/reports", "/journals", "/dashboard"];

const supplierInput = z.object({
  name: text("Name", 120),
  contact: optionalText(120),
  phone: optionalText(40),
});

export async function createSupplierAction(
  input: z.input<typeof supplierInput>,
): Promise<ActionResult<{ id: string }>> {
  const v = parse(supplierInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("create_supplier", {
    p_name: v.data.name,
    p_contact: v.data.contact,
    p_phone: v.data.phone,
  });
  if (!r.ok) return r;
  refresh("/purchasing", "/vendors");
  return { ok: true, data: { id: String(r.data) } };
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
        goodsValue: nonNegative("Value"),
      }),
    )
    .min(1, "Add at least one line"),
});

export async function receiveGoodsAction(
  input: z.input<typeof receiveInput>,
): Promise<ActionResult<{ receiptNo: number; value: number }>> {
  const v = parse(receiveInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("receive_goods", {
    p_supplier: v.data.supplierId,
    p_lines: v.data.lines.map((l) => ({
      item_id: l.itemId,
      qty: l.qty,
      unit_code: l.unitCode,
      goods_value: l.goodsValue,
    })),
    p_freight: v.data.freight,
    p_other: v.data.other,
    p_rebate: v.data.rebate,
    p_note: v.data.note,
  });
  if (!r.ok) return r;
  refresh(...BUY_PATHS);
  return {
    ok: true,
    data: { receiptNo: Number(r.data.receipt_no), value: Number(r.data.value ?? 0) },
  };
}

const billInput = z
  .object({
    supplierId: id("the vendor"),
    invoiceNo: text("The supplier's invoice number", 60),
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
): Promise<ActionResult<{ journalNo: number | null; priceVariance: number }>> {
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
  });
  if (!r.ok) return r;
  refresh(...BUY_PATHS, "/expenses");
  return {
    ok: true,
    data: {
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
      priceVariance: Number(r.data.price_variance ?? 0),
    },
  };
}

const payInput = z.object({
  billId: id("a bill"),
  amount: positive("The amount"),
  method: z.enum(["cash", "card", "bank"], { message: "Choose how it was paid" }),
});

export async function payBillAction(
  input: z.input<typeof payInput>,
): Promise<ActionResult<{ outstanding: number; journalNo: number | null }>> {
  const v = parse(payInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("pay_bill", {
    p_bill: v.data.billId,
    p_amount: v.data.amount,
    p_method: v.data.method,
  });
  if (!r.ok) return r;
  refresh(...BUY_PATHS);
  return {
    ok: true,
    data: {
      outstanding: Number(r.data.outstanding ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

const cancelInput = z.object({ billId: id("a bill"), reason: text("A reason", 300) });

/** A bill entered in error: kept on record, its journal reversed, no longer owed. */
export async function cancelBillAction(
  input: z.input<typeof cancelInput>,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("cancel_bill", {
    p_bill: v.data.billId,
    p_reason: v.data.reason,
    p_date: null,
  });
  if (!r.ok) return r;
  refresh(...BUY_PATHS);
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}
