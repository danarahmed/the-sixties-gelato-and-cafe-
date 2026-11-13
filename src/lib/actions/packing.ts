"use server";
/** Packing (0107): which stock items are packing, an order's defaults, and what each size goes out in. */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id } from "@/lib/validation";

const count = z
  .number()
  .int("An order takes from 0 to 20 of it by default")
  .min(0, "An order takes from 0 to 20 of it by default")
  .max(20, "An order takes from 0 to 20 of it by default");

const itemInput = z.object({
  itemId: id("a stock item"),
  role: z.enum(["bag", "cup", "lid", "box", "other"], {
    message: "Choose what it is: a bag, a cup, a lid, a box or other packing",
  }),
  takeaway: count,
  delivery: count,
  active: z.boolean(),
});

export async function savePackingItemAction(
  input: z.input<typeof itemInput>,
): Promise<ActionResult<null>> {
  const v = parse(itemInput, input);
  if (!v.ok) return v;
  const r = await callRpc("save_packing_item", {
    p_item: v.data.itemId,
    p_role: v.data.role,
    p_takeaway: v.data.takeaway,
    p_delivery: v.data.delivery,
    p_active: v.data.active,
  });
  if (!r.ok) return r;
  refresh("/settings", "/pos");
  return { ok: true, data: null };
}

const sizeInput = z.object({
  variantId: id("a product"),
  items: z
    .array(
      z.object({
        itemId: id("a packing item"),
        qty: z
          .number()
          .gt(0, "One sold takes from 1 to 10 of it")
          .max(10, "One sold takes from 1 to 10 of it"),
      }),
    )
    .max(10),
});

export async function setVariantPackingAction(
  input: z.input<typeof sizeInput>,
): Promise<ActionResult<null>> {
  const v = parse(sizeInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_variant_packing", {
    p_variant: v.data.variantId,
    p_items: v.data.items.map((x) => ({ item_id: x.itemId, qty: x.qty })),
  });
  if (!r.ok) return r;
  refresh("/settings", "/pos");
  return { ok: true, data: null };
}
