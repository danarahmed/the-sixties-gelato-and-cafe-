"use server";
/**
 * Pre-orders with deposits (0076): taken at the till with what the customer
 * pays now, collected later as a sale its deposit pays part of, or cancelled
 * with the deposit given back or kept. Each is one keyed database function.
 */
import { z } from "zod";
import { MISSING_UPDATE, badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, payments } from "@/lib/validation";
import { howPaid, saleReceipt } from "@/lib/payments";
import { tillForWrite } from "@/lib/place";
import { preOrderList, type PreOrderList } from "@/lib/preOrders";
import type { SaleReceipt } from "@/lib/actions/sales";

const PATHS = ["/pos", "/production", "/orders", "/dashboard", "/reports", "/journals"];

/** The open pre-orders at the till's branch; null before 0076 is applied. */
export async function listPreOrdersAction(): Promise<ActionResult<PreOrderList | null>> {
  const r = await callRpc<unknown>("pre_orders", { p_location: await tillForWrite() });
  if (!r.ok) return r.error === MISSING_UPDATE ? { ok: true, data: null } : r;
  return { ok: true, data: preOrderList(r.data) };
}

const takeInput = z.object({
  customer: z.string().trim().max(80, "A name is at most 80 letters"),
  phone: z.string().trim().max(40, "A phone number is at most 40 characters").nullish(),
  pickupAt: z.string().min(1, "Say when it is collected"),
  note: z.string().trim().max(500, "Too long").nullish(),
  channel: z.enum(["takeaway", "dine_in"], {
    message: "A pre-order is collected at the café: take it away or eat in",
  }),
  lines: z
    .array(
      z.object({
        variantId: id("a product"),
        qty: z.number().positive("Each line needs a positive quantity"),
        note: z.string().trim().max(200, "Too long").nullish(),
      }),
    )
    .min(1, "The cart is empty"),
  deposit: z
    .object({
      type: z.enum(["cash", "card", "other"]),
      amount: z
        .number()
        .int("The payments cannot be read")
        .positive("Each payment needs an amount more than 0"),
      method: z.string().uuid("Choose which way to pay it was").nullish(),
    })
    .nullish(),
});

/** Take a pre-order, with what the customer pays now (none, part or all). */
export async function takePreOrderAction(
  input: z.input<typeof takeInput>,
  key: string,
): Promise<ActionResult<{ id: string; no: number; total: number; deposit: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(takeInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("take_pre_order", {
    p_customer_name: v.data.customer,
    p_pickup_at: v.data.pickupAt,
    p_lines: v.data.lines.map((l) => ({
      variant_id: l.variantId,
      qty: l.qty,
      note: l.note ?? null,
    })),
    p_customer_phone: v.data.phone ?? null,
    p_note: v.data.note ?? null,
    p_channel: v.data.channel,
    p_deposit: v.data.deposit
      ? {
          type: v.data.deposit.type,
          amount: v.data.deposit.amount,
          method: v.data.deposit.type === "other" ? (v.data.deposit.method ?? null) : null,
        }
      : null,
    p_location: await tillForWrite(),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return {
    ok: true,
    data: {
      id: String(r.data.pre_order_id),
      no: Number(r.data.order_no),
      total: Number(r.data.total),
      deposit: Number(r.data.deposit),
    },
  };
}

const collectInput = z.object({
  preOrderId: id("a pre-order"),
  key: z.string().uuid(),
  tenders: payments.nullish(),
  expectedNet: z.number().nonnegative(),
});

/** Collect it: the sale, its deposit paying its part; the rest paid now. */
export async function collectPreOrderAction(
  input: z.input<typeof collectInput>,
): Promise<ActionResult<SaleReceipt & { preOrderNo: number; deposit: number }>> {
  const v = parse(collectInput, input);
  if (!v.ok) return v;
  const paid =
    v.data.tenders && v.data.tenders.length > 0 ? howPaid({ tenders: v.data.tenders }) : null;
  const r = await callRpc<Record<string, unknown>>("collect_pre_order", {
    p_pre_order: v.data.preOrderId,
    p_idempotency_key: v.data.key,
    p_tenders: paid?.p_tenders ?? null,
    p_expected_net: v.data.expectedNet,
  });
  if (!r.ok) return r;
  refresh(...PATHS, "/sales", "/inventory");
  return {
    ok: true,
    data: {
      ...saleReceipt(r.data),
      preOrderNo: Number(r.data.pre_order_no),
      deposit: Number(r.data.deposit ?? 0),
    },
  };
}

const cancelInput = z.object({
  preOrderId: id("a pre-order"),
  reason: z.string().trim().min(1, "Say why it is cancelled").max(300, "Too long"),
  keepDeposit: z.boolean(),
});

/** Cancel it: the deposit given back the way it was paid, or kept. */
export async function cancelPreOrderAction(
  input: z.input<typeof cancelInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("cancel_pre_order", {
    p_pre_order: v.data.preOrderId,
    p_reason: v.data.reason,
    p_keep_deposit: v.data.keepDeposit,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}
