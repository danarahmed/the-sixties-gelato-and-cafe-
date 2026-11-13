"use server";
/** The supplier's parts (0111): selling a stock item, customer prices, quotes, delivery notes, credit notes. */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, optionalText, positive, text } from "@/lib/validation";

const PATHS = ["/wholesale", "/customers", "/products"];
const done = () => {
  refresh(...PATHS);
  return { ok: true as const, data: null };
};

export async function makeItemSellableAction(input: {
  itemId: string;
  name: string;
  price: number;
  pack: number;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      itemId: id("a stock item"),
      name: text("Name", 120),
      price: positive("Price"),
      pack: z
        .number()
        .gt(0, "A pack is from 1 to 1000 of the item")
        .max(1000, "A pack is from 1 to 1000 of the item"),
    }),
    input,
  );
  if (!v.ok) return v;
  const price = Number(v.data.price);
  const r = await callRpc("make_item_sellable", {
    p_item: v.data.itemId,
    p_name: v.data.name,
    p_prices: { takeaway: price, dine_in: price },
    p_pack: v.data.pack,
  });
  return r.ok ? done() : r;
}

export async function setCustomerPriceAction(input: {
  customerId: string;
  variantId: string;
  price: number | null;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      customerId: id("the customer"),
      variantId: id("a product"),
      price: z.number().min(0, "A price is 0 or more").nullable(),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("set_customer_price", {
    p_customer: v.data.customerId,
    p_variant: v.data.variantId,
    p_price: v.data.price,
  });
  return r.ok ? done() : r;
}

export async function saveQuoteAction(input: {
  customerId: string;
  lines: { variantId: string; qty: number }[];
  validUntil: string | null;
  note: string | null;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      customerId: id("the customer"),
      lines: z
        .array(
          z.object({
            variantId: id("a product"),
            qty: z.number().positive("Each line needs a positive quantity"),
          }),
        )
        .min(1, "The cart is empty")
        .max(100),
      validUntil: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Good until must be a date")
        .nullable(),
      note: optionalText(300),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("save_quote", {
    p_id: null,
    p_customer: v.data.customerId,
    p_lines: v.data.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    p_valid_until: v.data.validUntil,
    p_note: v.data.note,
  });
  return r.ok ? done() : r;
}

export async function setQuoteStatusAction(
  quoteId: string,
  status: "sent" | "accepted" | "cancelled",
): Promise<ActionResult<null>> {
  const v = parse(
    z.object({ quoteId: id("a quote"), status: z.enum(["sent", "accepted", "cancelled"]) }),
    {
      quoteId,
      status,
    },
  );
  if (!v.ok) return v;
  const r = await callRpc("set_quote_status", { p_id: v.data.quoteId, p_status: v.data.status });
  return r.ok ? done() : r;
}

export async function invoiceQuoteAction(
  quoteId: string,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(z.object({ quoteId: id("a quote") }), { quoteId });
  if (!v.ok) return v;
  const r = await callRpc("quote_to_invoice", { p_id: v.data.quoteId, p_idempotency_key: key });
  return r.ok ? done() : r;
}

export async function makeDeliveryNoteAction(input: {
  invoiceId: string;
  driver: string;
  route: string | null;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({ invoiceId: id("an invoice"), driver: text("Driver", 80), route: optionalText(120) }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("make_delivery_note", {
    p_invoice: v.data.invoiceId,
    p_driver: v.data.driver,
    p_route: v.data.route,
  });
  return r.ok ? done() : r;
}

export async function setDeliveryStatusAction(input: {
  id: string;
  status: "out" | "delivered";
  receivedBy: string | null;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      id: id("a delivery note"),
      status: z.enum(["out", "delivered"]),
      receivedBy: optionalText(80),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("set_delivery_status", {
    p_id: v.data.id,
    p_status: v.data.status,
    p_received_by: v.data.receivedBy,
  });
  return r.ok ? done() : r;
}

export async function creditCustomerAction(
  input: { customerId: string; amount: number; reason: string },
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(
    z.object({
      customerId: id("the customer"),
      amount: z.number().positive("A credit note needs an amount more than 0"),
      reason: text("Why", 300),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("credit_customer", {
    p_customer: v.data.customerId,
    p_amount: v.data.amount,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  return r.ok ? done() : r;
}
