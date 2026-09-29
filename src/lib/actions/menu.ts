"use server";
/**
 * The menu: products with their recipe and prices, created in one step (a
 * half-made product could otherwise be sold at no cost), and price changes
 * that take effect from a date — history is kept, and a sale always uses the
 * price in force on its own day (audit M-04).
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day, id, nonNegative, optionalText, positive, salesChannel, text } from "@/lib/validation";

const MENU_PATHS = ["/products", "/pos", "/reports"];

const productInput = z.object({
  name: text("Product name", 120),
  nameAr: optionalText(120),
  nameCkb: optionalText(120),
  categoryId: id("a category").nullable().optional(),
  prices: z.record(salesChannel, positive("Price")),
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
  key: string,
): Promise<ActionResult<{ productId: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
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
    p_idempotency_key: key,
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
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_scheduled_price", {
    p_price: v.data.id,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}

/** A recipe set for a later date, withdrawn before it starts (0025). */
export async function cancelScheduledRecipeAction(
  input: z.input<typeof cancelInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_scheduled_recipe", {
    p_version: v.data.id,
    p_reason: v.data.reason,
    p_idempotency_key: key,
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
  /** One branch's own price (0055); none: every branch's. */
  placeId: z.string().uuid().nullable().optional(),
});

export async function setPriceAction(
  input: z.input<typeof priceInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(priceInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_price", {
    p_variant: v.data.variantId,
    p_channel: v.data.channel,
    p_price: v.data.price,
    p_effective_from: v.data.effectiveFrom,
    p_location: v.data.placeId ?? null,
    p_idempotency_key: key,
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
  key: string,
): Promise<ActionResult<{ effectiveFrom: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
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
    p_idempotency_key: key,
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
  key: string,
): Promise<ActionResult<{ id: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(categoryInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("save_category", {
    p_id: v.data.id,
    p_name: v.data.name,
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
    p_sort_order: v.data.sortOrder,
    p_is_active: v.data.isActive,
    p_idempotency_key: key,
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

// ------------------------------------------------------------------ sizes (0041)
const recipeLines = z.array(
  z.object({
    itemId: id("an ingredient"),
    qty: positive("Quantity"),
    unitCode: z.string().min(1),
    channels: z.array(salesChannel),
  }),
);
const recipeToDb = (
  lines: { itemId: string; qty: string | number; unitCode: string; channels: string[] }[],
) =>
  lines.map((l) => ({
    item_id: l.itemId,
    qty: l.qty,
    unit_code: l.unitCode,
    channels: l.channels,
  }));

const sizeInput = z.object({
  productId: id("a product"),
  name: text("The size's name", 60),
  nameAr: optionalText(60),
  nameCkb: optionalText(60),
  prices: z.record(salesChannel, positive("Price")),
  /** One of the three: its own recipe, another size's copied, or why it uses no stock. */
  recipe: recipeLines,
  copyFrom: id("a size to copy").nullable(),
  noStockReason: optionalText(200),
  /** The product's one size, named in the same step (Latte becomes Regular). */
  renameExisting: optionalText(60),
});

/** A size added to a product: its name, prices and recipe, in one step or not at all. */
export async function addSizeAction(
  input: z.input<typeof sizeInput>,
  key: string,
): Promise<ActionResult<{ variantId: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(sizeInput, input);
  if (!v.ok) return v;
  const own = v.data.recipe.length > 0;
  const r = await callRpc<Record<string, unknown>>("add_variant", {
    p_product: v.data.productId,
    p_name: v.data.name,
    p_prices: v.data.prices,
    p_recipe: own ? recipeToDb(v.data.recipe) : null,
    p_copy_from: own ? null : v.data.copyFrom,
    p_no_stock_reason: own || v.data.copyFrom ? null : v.data.noStockReason,
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
    p_rename_existing: v.data.renameExisting,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: { variantId: String(r.data.variant_id) } };
}

const renameSizeInput = z.object({
  variantId: id("a size"),
  name: text("The size's name", 60),
  nameAr: optionalText(60),
  nameCkb: optionalText(60),
});

/** A size renamed, in the three languages. */
export async function renameSizeAction(
  input: z.input<typeof renameSizeInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(renameSizeInput, input);
  if (!v.ok) return v;
  const r = await callRpc("update_variant", {
    p_variant: v.data.variantId,
    p_name: v.data.name,
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}

const retireSizeInput = z.object({
  variantId: id("a size"),
  retire: z.boolean(),
  reason: optionalText(300),
});

/** A size taken off the till with a reason, or brought back. Past sales keep it. */
export async function retireSizeAction(
  input: z.input<typeof retireSizeInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(retireSizeInput, input);
  if (!v.ok) return v;
  const r = await callRpc("retire_variant", {
    p_variant: v.data.variantId,
    p_retire: v.data.retire,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}

// ------------------------------------------------------------------ add-ons (0041)
const count = (label: string) =>
  z.number({ invalid_type_error: label }).int(label).min(0, label).max(20, label);

const groupInput = z.object({
  groupId: id("a group of add-ons").nullable(),
  name: text("The group's name", 60),
  nameAr: optionalText(60),
  nameCkb: optionalText(60),
  min: count("The fewest to choose is a number from 0 to 20"),
  max: count(
    "The most to choose is a number from 1 to 20, and no fewer than the fewest",
  ).nullable(),
  sort: z.number().int().min(0).max(999),
  isActive: z.boolean(),
});

/** A group of add-ons, new or changed: its names, the fewest and the most a line takes from it. */
export async function saveAddonGroupAction(
  input: z.input<typeof groupInput>,
  key: string,
): Promise<ActionResult<{ groupId: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(groupInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("save_modifier_group", {
    p_group: v.data.groupId,
    p_name: v.data.name,
    p_min: v.data.min,
    p_max: v.data.max,
    p_sort: v.data.sort,
    p_is_active: v.data.isActive,
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: { groupId: String(r.data.group_id) } };
}

const addonInput = z.object({
  modifierId: id("an add-on").nullable(),
  groupId: id("a group of add-ons"),
  name: text("The add-on's name", 60),
  nameAr: optionalText(60),
  nameCkb: optionalText(60),
  sort: z.number().int().min(0).max(999),
  isActive: z.boolean(),
  /** A new add-on's prices by channel (0 when it costs nothing), and what it uses for every size. */
  prices: z.record(salesChannel, nonNegative("Price")).optional(),
  recipe: recipeLines.optional(),
});

/** An add-on, new or changed. */
export async function saveAddonAction(
  input: z.input<typeof addonInput>,
  key: string,
): Promise<ActionResult<{ modifierId: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(addonInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("save_modifier", {
    p_modifier: v.data.modifierId,
    p_group: v.data.groupId,
    p_name: v.data.name,
    p_sort: v.data.sort,
    p_is_active: v.data.isActive,
    p_prices: v.data.modifierId === null ? (v.data.prices ?? {}) : null,
    p_recipe: v.data.modifierId === null && v.data.recipe ? recipeToDb(v.data.recipe) : null,
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: { modifierId: String(r.data.modifier_id) } };
}

const addonPriceInput = z.object({
  modifierId: id("an add-on"),
  channel: salesChannel,
  price: nonNegative("Price"),
  effectiveFrom: day("The first day").nullable(),
});

/** An add-on's new price on a channel, from today or a later day. */
export async function setAddonPriceAction(
  input: z.input<typeof addonPriceInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(addonPriceInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_modifier_price", {
    p_modifier: v.data.modifierId,
    p_channel: v.data.channel,
    p_price: v.data.price,
    p_effective_from: v.data.effectiveFrom,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}

const addonRecipeInput = z.object({
  modifierId: id("an add-on"),
  /** A size's own quantities; none for every size. */
  variantId: id("a size").nullable(),
  lines: recipeLines,
});

/** What an add-on uses from now on, for every size or one size's own. */
export async function setAddonRecipeAction(
  input: z.input<typeof addonRecipeInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(addonRecipeInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_modifier_recipe", {
    p_modifier: v.data.modifierId,
    p_variant: v.data.variantId,
    p_lines: recipeToDb(v.data.lines),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}

const productAddonsInput = z.object({
  productId: id("a product"),
  groups: z.array(
    z.object({ groupId: id("a group of add-ons"), variantId: id("a size").nullable() }),
  ),
});

/** The groups of add-ons a product offers, for all its sizes or one. */
export async function setProductAddonsAction(
  input: z.input<typeof productAddonsInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(productAddonsInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_product_modifiers", {
    p_product: v.data.productId,
    p_groups: v.data.groups.map((g) => ({ group_id: g.groupId, variant_id: g.variantId })),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MENU_PATHS);
  return { ok: true, data: null };
}
