"use server";
/**
 * Wholesale customers on account (0077): their limit, terms and price set; an
 * invoice made (a sale charged to their account); a payment received. Each is
 * one keyed database function.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id } from "@/lib/validation";
import { tillForWrite } from "@/lib/place";

const PATHS = [
  "/customers",
  "/dashboard",
  "/reports",
  "/journals",
  "/orders",
  "/sales",
  "/inventory",
];

const accountInput = z.object({
  customerId: id("a customer"),
  onAccount: z.boolean(),
  creditLimit: z.number().nonnegative("A credit limit is an amount of 0 or more"),
  termsDays: z
    .number()
    .int("Terms are from 0 to 365 days")
    .min(0, "Terms are from 0 to 365 days")
    .max(365, "Terms are from 0 to 365 days"),
  wholesalePercent: z
    .number()
    .min(0, "A wholesale price is from 0% to 90% off")
    .max(90, "A wholesale price is from 0% to 90% off"),
});

/** A customer put on account, or taken off it: their limit, terms and wholesale price. */
export async function setCustomerAccountAction(
  input: z.input<typeof accountInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(accountInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("set_customer_account", {
    p_customer: v.data.customerId,
    p_on_account: v.data.onAccount,
    p_credit_limit: v.data.creditLimit,
    p_terms_days: v.data.termsDays,
    p_wholesale_percent: v.data.wholesalePercent,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}

const invoiceInput = z.object({
  customerId: id("a customer"),
  note: z.string().trim().max(300, "A note is at most 300 letters").nullish(),
  lines: z
    .array(
      z.object({
        variantId: id("a product"),
        qty: z.number().positive("Each line needs a positive quantity"),
      }),
    )
    .min(1, "The cart is empty"),
});

/** An invoice: the sale charged to the customer's account, at their price. Keyed as a sale. */
export async function invoiceCustomerAction(
  input: z.input<typeof invoiceInput>,
  key: string,
): Promise<ActionResult<{ invoiceNo: number; amount: number; dueOn: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(invoiceInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("invoice_customer", {
    p_customer: v.data.customerId,
    p_lines: v.data.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    p_idempotency_key: key,
    p_note: v.data.note ?? null,
    p_location: await tillForWrite(),
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return {
    ok: true,
    data: {
      invoiceNo: Number(r.data.invoice_no),
      amount: Number(r.data.amount),
      dueOn: String(r.data.due_on),
    },
  };
}

const paymentInput = z.object({
  customerId: id("a customer"),
  amount: z.number().positive("Each payment needs an amount more than 0"),
  into: z.string().min(1, "Say where the money went: the till, the bank or a way to pay"),
  reference: z.string().trim().max(60, "A payment's reference is at most 60 letters").nullish(),
});

/** Money a customer on account paid: it pays their oldest invoices first. */
export async function receiveCustomerPaymentAction(
  input: z.input<typeof paymentInput>,
  key: string,
): Promise<ActionResult<{ balance: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(paymentInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("receive_customer_payment", {
    p_customer: v.data.customerId,
    p_amount: v.data.amount,
    p_into: v.data.into,
    p_reference: v.data.reference ?? null,
    p_location: await tillForWrite(),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS, "/cash");
  return { ok: true, data: { balance: Number(r.data.balance) } };
}
