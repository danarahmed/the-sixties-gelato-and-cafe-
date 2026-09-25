"use server";
/**
 * The till and its corrections. Each action is one database function: the
 * order, its lines, the stock it used and the balanced journal are written
 * together or not at all (audit C-04, C-06).
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import {
  discountAmount,
  discountPercent,
  id,
  nonNegative,
  optionalNonNegative,
  optionalText,
  positive,
  salesChannel,
  text,
} from "@/lib/validation";

// Not /pos: the till keeps itself current from each action's answer, and
// re-rendering it after every sale would only slow the cashier down.
const SALE_PATHS = ["/orders", "/sales", "/dashboard", "/inventory", "/reports", "/journals"];

const saleInput = z.object({
  /** Minted by the till when payment starts, reused on every retry (H-01, P0-4). */
  key: z.string().uuid("This sale has no idempotency key"),
  channel: salesChannel,
  tender: z.enum(["cash", "card", "platform_paid"], { message: "Choose how it was paid" }),
  lines: z
    .array(z.object({ variantId: id("a product"), qty: positive("Quantity") }))
    .min(1, "The cart is empty"),
  /** At most one of the two: a percentage of the bill, or an amount off it. */
  discountPercent,
  discountAmount,
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
}

export async function recordSaleAction(
  input: z.input<typeof saleInput>,
): Promise<ActionResult<SaleReceipt>> {
  const v = parse(saleInput, input);
  if (!v.ok) return v;
  if (v.data.discountPercent !== null && v.data.discountAmount !== null)
    return { ok: false, error: "Give the discount as a percentage or as an amount, not both" };
  const r = await callRpc<Record<string, unknown>>("record_sale", {
    p_idempotency_key: v.data.key,
    p_channel: v.data.channel,
    p_tender: v.data.tender,
    p_lines: v.data.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    p_discount_percent: v.data.discountPercent,
    p_discount_amount: v.data.discountAmount,
  });
  if (!r.ok) return r;
  refresh(...SALE_PATHS);
  return { ok: true, data: saleReceipt(r.data) };
}

/** A recorded sale, as the database reported it. */
function saleReceipt(d: Record<string, unknown>): SaleReceipt {
  const net = Number(d.net ?? 0);
  return {
    orderId: String(d.order_id),
    gross: Number(d.gross ?? net),
    discount: Number(d.discount ?? 0),
    net,
    ...(d.cogs !== undefined ? { cogs: Number(d.cogs) } : {}),
    journalNo: d.journal_no == null ? null : Number(d.journal_no),
    replayed: Boolean(d.replayed),
  };
}

const correction = z.object({ orderId: id("a sale"), reason: text("A reason", 300) });

/** Rung in error, before the drawer holding it is counted. Everything comes back. */
export async function voidSaleAction(
  input: z.input<typeof correction>,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const v = parse(correction, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("void_sale", {
    p_order: v.data.orderId,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...SALE_PATHS);
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}

/** Money back to the customer, through Sales returns; returnable goods go back on the shelf. */
export async function refundSaleAction(
  input: z.input<typeof correction>,
): Promise<ActionResult<{ refunded: number; journalNo: number | null }>> {
  const v = parse(correction, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("refund_sale", {
    p_order: v.data.orderId,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...SALE_PATHS);
  return {
    ok: true,
    data: {
      refunded: Number(r.data.refunded ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

const countInput = z.object({
  counted: nonNegative("Cash counted"),
  /** What stays in the drawer for the next session; empty keeps it all. */
  left: optionalNonNegative("What stays in the drawer"),
  takeTo: z.enum(["safe", "bank"]).nullable(),
  /** Only for the first count after days closed the old way. */
  startCash: optionalNonNegative("Cash when trading began"),
});

export interface DrawerCountResult {
  expected: number;
  counted: number;
  variance: number;
  left: number;
  taken: number;
  takenTo: string | null;
  journalNo: number | null;
}

/**
 * Count the drawer: everything since the last count, whatever the day. The
 * difference posts to 6300; what does not stay in the drawer goes to the safe
 * or the bank (0024).
 */
export async function countDrawerAction(
  input: z.input<typeof countInput>,
): Promise<ActionResult<DrawerCountResult>> {
  const v = parse(countInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("count_drawer", {
    p_counted: v.data.counted,
    p_left_in_drawer: v.data.left,
    p_take_to: v.data.takeTo,
    p_start_cash: v.data.startCash,
  });
  if (!r.ok) return r;
  refresh("/sales", "/journals", "/accounting", "/reports", "/orders", "/dashboard");
  return {
    ok: true,
    data: {
      expected: Number(r.data.expected ?? 0),
      counted: Number(r.data.counted ?? 0),
      variance: Number(r.data.variance ?? 0),
      left: Number(r.data.left ?? 0),
      taken: Number(r.data.taken ?? 0),
      takenTo: r.data.taken_to == null ? null : String(r.data.taken_to),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
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
): Promise<ActionResult<{ journalNo: number | null }>> {
  const v = parse(moveInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("move_cash", {
    p_from: v.data.from,
    p_to: v.data.to,
    p_amount: v.data.amount,
    p_note: v.data.note,
  });
  if (!r.ok) return r;
  refresh("/sales", "/journals", "/accounting", "/reports", "/dashboard");
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}
