"use server";
/**
 * The menu: products with their recipe and prices, created in one step (a
 * half-made product could otherwise be sold at no cost), and price changes
 * that take effect from a date — history is kept, and a sale always uses the
 * price in force on its own day (audit M-04).
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import {
  SALES_CHANNELS,
  day,
  id,
  optionalText,
  positive,
  salesChannel,
  text,
} from "@/lib/validation";

const MENU_PATHS = ["/products", "/pos", "/reports"];

const productInput = z.object({
  name: text("Product name", 120),
  nameAr: optionalText(120),
  nameCkb: optionalText(120),
  prices: z.record(z.enum(SALES_CHANNELS), positive("Price")),
  recipe: z.array(
    z.object({
      itemId: id("an ingredient"),
      qty: positive("Quantity"),
      unitCode: z.string().min(1),
      channels: z.array(salesChannel),
    }),
  ),
});

export async function createProductAction(
  input: z.input<typeof productInput>,
): Promise<ActionResult<{ productId: string }>> {
  const v = parse(productInput, input);
  if (!v.ok) return v;
  if (Object.keys(v.data.prices).length === 0)
    return { ok: false, error: "Give the product at least one price" };
  const r = await callRpc<Record<string, unknown>>("create_product", {
    p_name: v.data.name,
    p_prices: v.data.prices,
    p_recipe: v.data.recipe.map((l) => ({
      item_id: l.itemId,
      qty: l.qty,
      unit_code: l.unitCode,
      channels: l.channels,
    })),
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: { productId: String(r.data.product_id) } };
}

const priceInput = z.object({
  variantId: id("a product"),
  channel: salesChannel,
  price: positive("Price"),
  effectiveFrom: day("The start date"),
});

export async function setPriceAction(
  input: z.input<typeof priceInput>,
): Promise<ActionResult<null>> {
  const v = parse(priceInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_price", {
    p_variant: v.data.variantId,
    p_channel: v.data.channel,
    p_price: v.data.price,
    p_effective_from: v.data.effectiveFrom,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}
