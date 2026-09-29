"use server";
/**
 * Customers at the till and on Customers (0050): found by their number, added,
 * their details and addresses changed, and points given or taken by hand. Each
 * write is one database function that checks the person's permission and
 * says why it refuses.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { tillCustomerFrom, type TillCustomer } from "@/lib/customers";
import { id, normaliseNumber, optionalText, text } from "@/lib/validation";

const CUSTOMER_PATHS = ["/customers", "/reports"];

/** A customer by their phone number, typed any way; null when nobody has it. */
export async function findCustomerAction(
  phone: string,
): Promise<ActionResult<TillCustomer | null>> {
  const v = parse(text("Phone", 40), phone);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("find_customer", { p_phone: v.data });
  if (!r.ok) return r;
  return { ok: true, data: tillCustomerFrom(r.data) };
}

/** A customer by their id, as a bill names them: their points now. */
export async function customerAtTillAction(
  customerId: string,
): Promise<ActionResult<TillCustomer>> {
  const v = parse(id("the customer"), customerId);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("customer_at_till", { p_customer: v.data });
  if (!r.ok) return r;
  const c = tillCustomerFrom(r.data);
  return c ? { ok: true, data: c } : { ok: false, error: "Customer not found" };
}

const customerInput = z.object({
  customerId: id("the customer").nullish(),
  name: text("Name", 80),
  phone: text("Phone", 40),
  notes: optionalText(500),
  active: z.boolean().default(true),
});

/** A customer added, or their details changed; put away, or brought back. */
export async function saveCustomerAction(
  input: z.input<typeof customerInput>,
  key: string,
): Promise<ActionResult<{ customerId: string; phone: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(customerInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("save_customer", {
    p_customer: v.data.customerId ?? null,
    p_name: v.data.name,
    p_phone: v.data.phone,
    p_notes: v.data.notes,
    p_active: v.data.active,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...CUSTOMER_PATHS);
  return {
    ok: true,
    data: { customerId: String(r.data.customer_id ?? ""), phone: String(r.data.phone ?? "") },
  };
}

const addressInput = z.object({
  customerId: id("the customer"),
  addressId: id("the address").nullish(),
  label: optionalText(40),
  address: optionalText(300),
  directions: optionalText(300),
  active: z.boolean().default(true),
});

/** An address added or changed, or put away (never deleted: a delivery keeps what it said). */
export async function saveCustomerAddressAction(
  input: z.input<typeof addressInput>,
  key: string,
): Promise<ActionResult<{ addressId: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(addressInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("save_customer_address", {
    p_customer: v.data.customerId,
    p_address: v.data.addressId ?? null,
    p_label: v.data.label,
    p_text: v.data.address,
    p_directions: v.data.directions,
    p_active: v.data.active,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...CUSTOMER_PATHS);
  return { ok: true, data: { addressId: String(r.data.address_id ?? "") } };
}

const pointsInput = z.object({
  customerId: id("the customer"),
  points: z
    .union([z.string(), z.number()])
    .transform(normaliseNumber)
    .refine(
      (v) => /^-?\d+$/.test(v) && Number(v) !== 0,
      "Enter the points to give, or with a minus to take",
    )
    .transform(Number),
  reason: text("Why", 300),
});

/** Points given, or taken, by hand, with why (loyalty.adjust). */
export async function adjustPointsAction(
  input: z.input<typeof pointsInput>,
  key: string,
): Promise<ActionResult<{ points: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(pointsInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("adjust_points", {
    p_customer: v.data.customerId,
    p_points: v.data.points,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...CUSTOMER_PATHS);
  return { ok: true, data: { points: Number(r.data.points ?? 0) } };
}
