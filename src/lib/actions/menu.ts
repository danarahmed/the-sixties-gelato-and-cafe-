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
  categoryId: id("a category").nullable().optional(),
  prices: z.record(z.enum(SALES_CHANNELS), positive("Price")),
  recipe: z.array(
    z.object({
      itemId: id("an ingredient"),
      qty: positive("Quantity"),
      unitCode: z.string().min(1),
      channels: z.array(salesChannel),
    }),
  ),
  /** With no recipe: why it uses no stock (0025). */
  noStockReason: optionalText(200),
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
    p_category: v.data.categoryId ?? null,
    p_no_stock_reason: v.data.recipe.length === 0 ? v.data.noStockReason : null,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: { productId: String(r.data.product_id) } };
}

const cancelInput = z.object({
  id: id("a change"),
  reason: text("Why the change is withdrawn", 300),
});

/** A price set for a later date, withdrawn before it starts (0025). */
export async function cancelScheduledPriceAction(
  input: z.input<typeof cancelInput>,
): Promise<ActionResult<null>> {
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_scheduled_price", {
    p_price: v.data.id,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}

/** A recipe set for a later date, withdrawn before it starts (0025). */
export async function cancelScheduledRecipeAction(
  input: z.input<typeof cancelInput>,
): Promise<ActionResult<null>> {
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_scheduled_recipe", {
    p_version: v.data.id,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}

const noStockInput = z.object({
  variantId: id("a product"),
  reason: optionalText(200),
});

/** A product with no recipe says why it uses no stock (or, with no reason, takes that back). */
export async function setNoStockAction(
  input: z.input<typeof noStockInput>,
): Promise<ActionResult<null>> {
  const v = parse(noStockInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_no_stock", { p_variant: v.data.variantId, p_reason: v.data.reason });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
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

const recipeInput = z.object({
  variantId: id("a product"),
  lines: z
    .array(
      z.object({
        itemId: id("an ingredient"),
        qty: positive("Quantity"),
        unitCode: z.string().min(1),
        channels: z.array(salesChannel),
      }),
    )
    .min(1, "List what goes into one serving"),
  effectiveFrom: day("The start date"),
});

/**
 * A product's recipe changed from a date (today or later). The recipe before
 * it stays in force until then, and every sale keeps the recipe of its own day.
 */
export async function changeProductRecipeAction(
  input: z.input<typeof recipeInput>,
): Promise<ActionResult<{ effectiveFrom: string }>> {
  const v = parse(recipeInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("change_product_recipe", {
    p_variant: v.data.variantId,
    p_lines: v.data.lines.map((l) => ({
      item_id: l.itemId,
      qty: l.qty,
      unit_code: l.unitCode,
      channels: l.channels,
    })),
    p_effective_from: v.data.effectiveFrom,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: { effectiveFrom: String(r.data.effective_from) } };
}

const categoryInput = z.object({
  id: id("a category").nullable(),
  name: text("The category's name", 60),
  nameAr: optionalText(60),
  nameCkb: optionalText(60),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

/** Add or change a category: its names, its place on the till, and whether the till shows it. */
export async function saveCategoryAction(
  input: z.input<typeof categoryInput>,
): Promise<ActionResult<{ id: string }>> {
  const v = parse(categoryInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("save_category", {
    p_id: v.data.id,
    p_name: v.data.name,
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
    p_sort_order: v.data.sortOrder,
    p_is_active: v.data.isActive,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: { id: String(r.data) } };
}

const detailsInput = z.object({
  productId: id("a product"),
  name: text("Product name", 120),
  nameAr: optionalText(120),
  nameCkb: optionalText(120),
  categoryId: id("a category").nullable(),
  isActive: z.boolean(),
  isFavourite: z.boolean(),
});

/** A product's names, category, and whether the till offers it (and among the favourites). */
export async function setProductDetailsAction(
  input: z.input<typeof detailsInput>,
): Promise<ActionResult<null>> {
  const v = parse(detailsInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_product_details", {
    p_product: v.data.productId,
    p_name: v.data.name,
    p_category: v.data.categoryId,
    p_is_active: v.data.isActive,
    p_is_favourite: v.data.isFavourite,
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}

const imageInput = z.object({
  productId: id("a product"),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"], {
    message: "Use a PNG, JPEG or WebP picture",
  }),
  /** The picture, already shrunk by the browser, as base64. */
  data: z
    .string()
    .min(1, "Choose a picture")
    .max(410_000, "The picture must be smaller than 300 KB")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "The picture could not be read"),
});

/** A product's photo, shown on its tile at the till. The database checks the bytes really are a picture. */
export async function setProductImageAction(
  input: z.input<typeof imageInput>,
): Promise<ActionResult<{ imageUrl: string }>> {
  const v = parse(imageInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("set_product_image", {
    p_product: v.data.productId,
    p_content_type: v.data.contentType,
    p_data: v.data.data,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: { imageUrl: String(r.data) } };
}

const productRef = z.object({ productId: id("a product") });

export async function clearProductImageAction(
  input: z.input<typeof productRef>,
): Promise<ActionResult<null>> {
  const v = parse(productRef, input);
  if (!v.ok) return v;
  const r = await callRpc("clear_product_image", { p_product: v.data.productId });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}
