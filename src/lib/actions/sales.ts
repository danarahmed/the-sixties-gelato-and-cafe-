"use server";
/**
 * The till and its corrections. Each action is one database function: the
 * order, its lines, the stock it used and the balanced journal are written
 * together or not at all (audit C-04, C-06).
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { isPlatformChannel } from "@/lib/channels";
import {
  discountAmount,
  discountPercent,
  id,
  nonNegative,
  optionalNonNegative,
  optionalText,
  platformOrderNo,
  positive,
  salesChannel,
  text,
  addonsToDb,
  lineAddons,
  payments,
} from "@/lib/validation";
import { howPaid, saleReceipt, type PaidPart } from "@/lib/payments";

// Not /pos: the till keeps itself current from each action's answer, and
// re-rendering it after every sale would only slow the cashier down.
const SALE_PATHS = [
  "/orders",
  "/sales",
  "/dashboard",
  "/inventory",
  "/reports",
  "/journals",
  "/platforms",
];

const saleInput = z.object({
  /** Minted by the till when payment starts, reused on every retry (H-01, P0-4). */
  key: z.string().uuid("This sale has no idempotency key"),
  channel: salesChannel,
  /** How it was paid: one way for all of it (a till loaded before 0042), or each part of it (0042). */
  tender: z
    .enum(["cash", "card", "platform_paid"], { message: "Choose how it was paid" })
    .nullish(),
  tenders: payments.nullish(),
  lines: z
    .array(z.object({ variantId: id("a product"), qty: positive("Quantity"), addons: lineAddons }))
    .min(1, "The cart is empty"),
  /** At most one of the two: a percentage of the bill, or an amount off it. */
  discountPercent,
  discountAmount,
  /** Why (0028): a reason from the list, a note for "Other", and a manager's approval over the cap. */
  discountReason: optionalText(40),
  discountNote: optionalText(300),
  approvalId: id("an approval").nullish(),
  /**
   * The total the till showed the customer. If the database would record
   * another (a price changed since the till loaded its menu), nothing is
   * recorded and the till is told the new total (0025).
   */
  expectedNet: optionalNonNegative("The total shown"),
  /** A delivery platform's sale: its order number, which its payout is matched by (0030). */
  platformOrderNo,
  /** A manager's approval of selling more than the books hold, when its rule asks (0040). */
  stockApprovalId: id("an approval").nullish(),
});

export interface SaleReceipt {
  orderId: string;
  /** Before the discount. */
  gross: number;
  discount: number;
  /** What the customer paid. */
  net: number;
  /** Only for people allowed to see costs. */
  cogs?: number;
  journalNo: number | null;
  /** True when this key had already been recorded: the original sale is returned. */
  replayed: boolean;
  /** A delivery platform's order number, as recorded. */
  platformOrderNo: string | null;
  /** The order's turn number, called out when it is ready (0034); none on a sale from before. */
  turnNo: number | null;
  /** Each payment as recorded, with the change it gave (0042). */
  payments: PaidPart[];
}

export async function recordSaleAction(
  input: z.input<typeof saleInput>,
): Promise<ActionResult<SaleReceipt>> {
  const v = parse(saleInput, input);
  if (!v.ok) return v;
  if (v.data.discountPercent !== null && v.data.discountAmount !== null)
    return { ok: false, error: "Give the discount as a percentage or as an amount, not both" };
  const paid = howPaid(v.data);
  if (!paid) return { ok: false, error: "Choose how it was paid" };
  // Only a delivery platform's sale has one; the database asks for it (0030).
  const orderNo = isPlatformChannel(v.data.channel) ? v.data.platformOrderNo : null;
  const r = await callRpc<Record<string, unknown>>("record_sale", {
    p_idempotency_key: v.data.key,
    p_channel: v.data.channel,
    p_tender: paid.p_tender,
    p_tenders: paid.p_tenders,
    p_lines: v.data.lines.map((l) => ({
      variant_id: l.variantId,
      qty: l.qty,
      modifiers: addonsToDb(l.addons),
    })),
    p_discount_percent: v.data.discountPercent,
    p_discount_amount: v.data.discountAmount,
    p_expected_net: v.data.expectedNet,
    p_discount_reason: v.data.discountReason,
    p_discount_note: v.data.discountNote,
    p_approval: v.data.approvalId ?? null,
    p_platform_order_no: orderNo,
    p_stock_approval: v.data.stockApprovalId ?? null,
  });
  if (!r.ok) return r;
  refresh(...SALE_PATHS, "/platforms");
  return { ok: true, data: saleReceipt(r.data) };
}

const correction = z.object({
  orderId: id("a sale"),
  /** A reason from the list (0028); "other" needs the note, in a few real words. */
  reasonCode: text("A reason", 40),
  note: optionalText(300),
  /** A second person's approval, by their name and PIN; without one it waits for the owner's review. */
  approvalId: id("an approval").nullish(),
});

/** Rung in error, before the drawer holding it is counted. Everything comes back. */
export async function voidSaleAction(
  input: z.input<typeof correction>,
  key: string,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(correction, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("void_sale", {
    p_order: v.data.orderId,
    p_reason: v.data.note,
    p_reason_code: v.data.reasonCode,
    p_approval: v.data.approvalId ?? null,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...SALE_PATHS);
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}

const refundInput = correction.extend({
  /** How many of each of the sale's lines go back (0037). */
  lines: z
    .array(
      z.object({
        lineId: id("an item of the sale"),
        qty: z.number().positive("Refund at least one"),
      }),
    )
    .min(1, "Choose what to refund"),
  /**
   * How the money goes back, for a sale paid more than one way (0042): each
   * way's part. Left out, the database shares it in proportion.
   */
  tenders: z
    .array(
      z.object({
        type: z.enum(["cash", "card", "platform_paid"], { message: "Choose how it was paid" }),
        amount: positive("Amount"),
      }),
    )
    .max(3, "The payments to give back cannot be read")
    .nullish(),
});

/** What a refund by the item did, as the database reported it. */
export interface RefundResult {
  refundNo: number;
  refunded: number;
  tender: string;
  /** Each way it went back (0042), in the order the sale was paid. */
  tenders: { type: string; amount: number }[];
  status: string;
  whole: boolean;
  journalNo: number | null;
  lines: { lineId: string; name: string; qty: number; amount: number }[];
  replayed: boolean;
}

/**
 * Money back to the customer for some of a sale's items, or all that is left
 * of it, through Sales returns (0037); what can go back on the shelf does.
 */
export async function refundLinesAction(
  input: z.input<typeof refundInput>,
  key: string,
): Promise<ActionResult<RefundResult>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(refundInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("refund_sale_lines", {
    p_order: v.data.orderId,
    p_lines: v.data.lines.map((l) => ({ line_id: l.lineId, qty: l.qty })),
    p_reason_code: v.data.reasonCode,
    p_reason: v.data.note,
    p_approval: v.data.approvalId ?? null,
    ...(v.data.tenders
      ? { p_tenders: v.data.tenders.map((x) => ({ type: x.type, amount: Number(x.amount) })) }
      : {}),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...SALE_PATHS);
  const d = r.data;
  return {
    ok: true,
    data: {
      refundNo: Number(d.refund_no ?? 0),
      refunded: Number(d.refunded ?? 0),
      tender: String(d.tender ?? ""),
      tenders: Array.isArray(d.tenders)
        ? (d.tenders as Record<string, unknown>[]).map((x) => ({
            type: String(x.type),
            amount: Number(x.amount ?? 0),
          }))
        : [],
      status: String(d.status ?? ""),
      whole: Boolean(d.whole),
      journalNo: d.journal_no == null ? null : Number(d.journal_no),
      lines: Array.isArray(d.lines)
        ? (d.lines as Record<string, unknown>[]).map((l) => ({
            lineId: String(l.line_id),
            name: String(l.name ?? ""),
            qty: Number(l.qty ?? 0),
            amount: Number(l.amount ?? 0),
          }))
        : [],
      replayed: Boolean(d.replayed),
    },
  };
}

const PLACES = ["till", "safe", "bank", "owner"] as const;
const moveInput = z.object({
  from: z.enum(PLACES, { message: "Choose where the cash comes from" }),
  to: z.enum(PLACES, { message: "Choose where the cash goes" }),
  amount: positive("Amount"),
  note: optionalText(200),
});

/** Cash moved between the till, the safe, the bank and the owner. */
export async function moveCashAction(
  input: z.input<typeof moveInput>,
  key: string,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(moveInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("move_cash", {
    p_from: v.data.from,
    p_to: v.data.to,
    p_amount: v.data.amount,
    p_note: v.data.note,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/sales", "/journals", "/accounting", "/reports", "/dashboard");
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}
