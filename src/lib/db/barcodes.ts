import "server-only";
/**
 * Barcodes (0078): each size's, by its id. Null before the owner applies
 * 0078: Products & Recipes then offers nothing of it.
 */
import { db, str, type Row } from "./client";

export async function getBarcodes(): Promise<Map<string, string> | null> {
  const c = await db();
  const r = await c.from("product_variant").select("id,barcode").not("barcode", "is", null);
  if (r.error) return null;
  return new Map(((r.data ?? []) as Row[]).map((x) => [str(x.id), str(x.barcode)]));
}
