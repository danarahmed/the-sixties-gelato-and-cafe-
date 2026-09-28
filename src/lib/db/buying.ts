import "server-only";
/**
 * The buying list (0045, release T), and who each item is bought from. Each
 * read runs as the signed-in person, for those who may see costs.
 */
import { buyingListFrom, type BuyingList } from "@/lib/buying";
import { db, numOrNull, one, rows, str, strOrNull } from "./client";

/** What to buy for a location (the first branch when none is named). */
export async function getBuyingList(locationId: string | null = null): Promise<BuyingList> {
  const c = await db();
  return buyingListFrom(
    one(await c.rpc("buying_list", { p_location: locationId }), "the buying list") as Record<
      string,
      unknown
    > | null,
  );
}

export interface ItemSupplier {
  supplierId: string;
  supplier: string;
  /** A supplier out of use stays on the list, and is not suggested. */
  active: boolean;
  packUnit: string;
  /** A pack's price, agreed last, and the day it was. */
  lastPrice: number | null;
  lastPriceOn: string | null;
  usual: boolean;
}

/** Who an item is bought from: its usual supplier first, then by name. */
export async function getItemSuppliers(itemId: string): Promise<ItemSupplier[]> {
  const c = await db();
  const r = await c
    .from("item_supplier")
    .select(
      "supplier_id,pack_unit_code,last_price,last_price_on,preferred,supplier:supplier_id(name,is_active)",
    )
    .eq("item_id", itemId);
  return rows(r, "the item's suppliers")
    .map((x) => {
      const s = (Array.isArray(x.supplier) ? x.supplier[0] : x.supplier) as
        Record<string, unknown> | null | undefined;
      return {
        supplierId: str(x.supplier_id),
        supplier: str(s?.name),
        active: s?.is_active !== false,
        packUnit: str(x.pack_unit_code),
        lastPrice: numOrNull(x.last_price),
        lastPriceOn: strOrNull(x.last_price_on),
        usual: x.preferred === true,
      };
    })
    .sort((a, b) => Number(b.usual) - Number(a.usual) || a.supplier.localeCompare(b.supplier));
}
