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

/** A supplier's deliveries as its orders have shown them (0092). */
export interface SupplierRecord {
  supplierId: string;
  supplier: string;
  /** The days used for a delivery, and where they come from. */
  lead: number;
  leadFrom: "learned" | "supplier" | "cafe";
  /** Orders sent in six months with a delivery against them; the usual days, how many came later, the most lately. */
  orders: number;
  usual: number | null;
  late: number | null;
  worst: number | null;
  /** How often it delivers, and where that comes from. */
  every: number;
  everyFrom: "supplier" | "learned" | "default";
}

/** Each supplier in use, with its deliveries (0092); none before 0092 is applied. */
export async function getSupplierRecords(): Promise<SupplierRecord[]> {
  const c = await db();
  const r = await c.rpc("supplier_records");
  if (r.error || !Array.isArray(r.data)) return [];
  return (r.data as Record<string, unknown>[]).map((x) => ({
    supplierId: str(x.supplier_id),
    supplier: str(x.supplier),
    lead: Number(x.lead ?? 0),
    leadFrom:
      x.lead_from === "learned" ? "learned" : x.lead_from === "supplier" ? "supplier" : "cafe",
    orders: Number(x.orders ?? 0),
    usual: numOrNull(x.usual),
    late: numOrNull(x.late),
    worst: numOrNull(x.worst),
    every: Number(x.every ?? 7),
    everyFrom:
      x.every_from === "supplier" ? "supplier" : x.every_from === "learned" ? "learned" : "default",
  }));
}
