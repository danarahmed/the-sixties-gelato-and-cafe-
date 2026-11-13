"use server";
/** The menu on the customer's phone (0118): the owner's link, on or off, at a place, or a new one. */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";

const input = z.object({
  enabled: z.boolean(),
  locationId: z.string().guid().nullable().default(null),
  newLink: z.boolean().default(false),
});

export async function setPublicMenuAction(
  v0: z.input<typeof input>,
): Promise<ActionResult<{ enabled: boolean; token: string }>> {
  const v = parse(input, v0);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_public_menu", {
    p_enabled: v.data.enabled,
    p_location: v.data.locationId,
    p_new_link: v.data.newLink,
  });
  if (!r.ok) return r;
  refresh("/settings");
  return {
    ok: true,
    data: { enabled: r.data.enabled === true, token: String(r.data.token ?? "") },
  };
}

const switches = z.object({ toTill: z.boolean(), online: z.boolean() });

/** (the owner) Orders sent from phones to the till (0119): a table's, and to take away or deliver. */
export async function setPhoneOrdersAction(
  v0: z.input<typeof switches>,
): Promise<ActionResult<{ toTill: boolean; online: boolean }>> {
  const v = parse(switches, v0);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_phone_orders", {
    p_to_till: v.data.toTill,
    p_online: v.data.online,
  });
  if (!r.ok) return r;
  refresh("/settings");
  return { ok: true, data: { toTill: r.data.to_till === true, online: r.data.online === true } };
}

const orderInput = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,40}$/, "This menu is not available"),
  kind: z.enum(["table", "pickup", "delivery"]),
  lines: z
    .array(z.object({ variantId: z.string().guid(), qty: z.number().int().min(1).max(20) }))
    .min(1, "Choose up to 30 things")
    .max(30, "Choose up to 30 things"),
  name: z.string().max(80).nullish(),
  phone: z.string().max(40).nullish(),
  table: z.string().max(40).nullish(),
  address: z.string().max(300).nullish(),
  note: z.string().max(300).nullish(),
});

/** (anyone with the menu's link) An order sent from the phone to the till (0119). */
export async function submitPhoneOrderAction(
  v0: z.input<typeof orderInput>,
): Promise<ActionResult<{ orderId: string; orderNo: number }>> {
  const v = parse(orderInput, v0);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("submit_phone_order", {
    p_token: v.data.token,
    p_kind: v.data.kind,
    p_lines: v.data.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    p_name: v.data.name ?? null,
    p_phone: v.data.phone ?? null,
    p_table: v.data.table ?? null,
    p_address: v.data.address ?? null,
    p_note: v.data.note ?? null,
  });
  if (!r.ok) return r;
  return { ok: true, data: { orderId: String(r.data.order_id), orderNo: Number(r.data.order_no) } };
}

/** (anyone with the link and the order's id) Where the phone's order stands. */
export async function phoneOrderStatusAction(input: {
  token: string;
  orderId: string;
}): Promise<ActionResult<{ status: string; reason: string | null }>> {
  const v = parse(z.object({ token: z.string().max(40), orderId: z.string().guid() }), input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown> | null>("phone_order_status", {
    p_token: v.data.token,
    p_order: v.data.orderId,
  });
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      status: String(r.data?.status ?? "new"),
      reason: r.data?.reason ? String(r.data.reason) : null,
    },
  };
}

export interface PhoneOrder {
  id: string;
  orderNo: number;
  kind: "table" | "pickup" | "delivery";
  table: string | null;
  name: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  lines: { variantId: string; qty: number }[];
  status: string;
}

/** (sale.create) The orders from phones at the till (0119); none before it. */
export async function phoneOrdersAction(): Promise<ActionResult<PhoneOrder[]>> {
  const r = await callRpc<Record<string, unknown>[]>("phone_orders", {});
  if (!r.ok) return { ok: true, data: [] };
  return {
    ok: true,
    data: (r.data ?? []).map((o) => ({
      id: String(o.id),
      orderNo: Number(o.order_no),
      kind: String(o.kind) as PhoneOrder["kind"],
      table: o.table ? String(o.table) : null,
      name: o.name ? String(o.name) : null,
      phone: o.phone ? String(o.phone) : null,
      address: o.address ? String(o.address) : null,
      note: o.note ? String(o.note) : null,
      lines: (Array.isArray(o.lines) ? (o.lines as Record<string, unknown>[]) : []).map((l) => ({
        variantId: String(l.variant_id),
        qty: Number(l.qty),
      })),
      status: String(o.status),
    })),
  };
}

/** (sale.create) A phone's order taken (rung up at the till) or turned down, with why. */
export async function handlePhoneOrderAction(input: {
  orderId: string;
  accept: boolean;
  reason?: string | null;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      orderId: z.string().guid(),
      accept: z.boolean(),
      reason: z.string().max(200).nullish(),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc<unknown>("handle_phone_order", {
    p_order: v.data.orderId,
    p_accept: v.data.accept,
    p_reason: v.data.reason ?? null,
  });
  if (!r.ok) return r;
  return { ok: true, data: null };
}
