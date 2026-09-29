import "server-only";
/**
 * Stock sent between the café's places (0054, release AB): the transfers, and
 * what each place holds, for those who may see costs or send stock.
 */
import { transfersFrom, type Transfer } from "@/lib/transfers";
import { db, num, one, rows, str } from "./client";

/** The transfers, the latest first. */
export async function getTransfers(limit = 100): Promise<Transfer[]> {
  const c = await db();
  return transfersFrom(one(await c.rpc("stock_transfers", { p_limit: limit }), "the transfers"));
}

/** What each place holds of each item, in its base unit: place → item → stock. */
export async function getStockByPlace(): Promise<Record<string, Record<string, number>>> {
  const c = await db();
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows(
    await c.from("stock_board").select("item_id,location_id,quantity_base"),
    "stock at each place",
  )) {
    const place = str(r.location_id);
    (out[place] ??= {})[str(r.item_id)] = num(r.quantity_base);
  }
  return out;
}
