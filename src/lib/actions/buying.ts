"use server";
/**
 * The buying list (0045, release T): the orders drafted from it, one for each
 * supplier, and who an item is bought from, in what pack, at what price.
 * Each is keyed, as every write is.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, nonNegative, optionalNonNegative, positive } from "@/lib/validation";

const listLines = z
  .array(
    z.object({
      itemId: id("an item"),
      supplierId: id("the supplier"),
      qty: positive("Quantity"),
      unitCode: z.string().min(1, "Choose a unit"),
      unitPrice: nonNegative("Price per unit"),
      /** Make this supplier the item's usual one. */
      usual: z.boolean().default(false),
    }),
  )
  .min(1, "Choose at least one item to order")
  .max(300, "At most 300 lines at once");

const draftInput = z.object({
  /** The list's location: the orders are for it. */
  locationId: z.string().uuid().nullable().default(null),
  lines: listLines,
});

export interface DraftedOrder {
  poId: string;
  poNo: number;
  supplier: string;
  expectedOn: string | null;
  total: number;
  lines: number;
}

/**
 * The lines chosen on the buying list: a draft order for each supplier, for a
 * manager to approve (0045). Keyed: sent twice, drafted once.
 */
export async function draftOrdersFromListAction(
  input: z.input<typeof draftInput>,
  key: string,
): Promise<ActionResult<{ orders: DraftedOrder[] }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(draftInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("purchase_orders_from_list", {
    p_lines: v.data.lines.map((l) => ({
      item_id: l.itemId,
      supplier_id: l.supplierId,
      qty: l.qty,
      unit_code: l.unitCode,
      unit_price: l.unitPrice,
      usual: l.usual,
    })),
    p_location: v.data.locationId,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/purchasing", "/purchasing/buying-list", "/purchasing/orders", "/inventory", "/reports");
  const orders = Array.isArray(r.data.orders) ? (r.data.orders as Record<string, unknown>[]) : [];
  return {
    ok: true,
    data: {
      orders: orders.map((o) => ({
        poId: String(o.po_id),
        poNo: Number(o.po_no),
        supplier: String(o.supplier ?? ""),
        expectedOn: o.expected_on == null ? null : String(o.expected_on),
        total: Number(o.total ?? 0),
        lines: Number(o.lines ?? 0),
      })),
    },
  };
}

const supplierInput = z.object({
  itemId: id("an item"),
  supplierId: id("the supplier"),
  packUnit: z.string().min(1, "Choose a unit"),
  /** A pack's price; left empty, the one agreed before stays. */
  price: optionalNonNegative("Price of a pack"),
  usual: z.boolean().default(false),
});

/** A supplier of an item set: its pack, a pack's price, whether it is the usual one (0045). Keyed. */
export async function setItemSupplierAction(
  input: z.input<typeof supplierInput>,
  key: string,
): Promise<ActionResult<{ usual: boolean }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(supplierInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_item_supplier", {
    p_item: v.data.itemId,
    p_supplier: v.data.supplierId,
    p_pack_unit: v.data.packUnit,
    p_price: v.data.price,
    p_usual: v.data.usual,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(`/inventory/${v.data.itemId}`, "/purchasing/buying-list");
  return { ok: true, data: { usual: r.data.usual === true } };
}

const removeInput = z.object({ itemId: id("an item"), supplierId: id("the supplier") });

/** A supplier the item is no longer bought from (0045). Keyed. */
export async function removeItemSupplierAction(
  input: z.input<typeof removeInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(removeInput, input);
  if (!v.ok) return v;
  const r = await callRpc("remove_item_supplier", {
    p_item: v.data.itemId,
    p_supplier: v.data.supplierId,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(`/inventory/${v.data.itemId}`, "/purchasing/buying-list");
  return { ok: true, data: null };
}
