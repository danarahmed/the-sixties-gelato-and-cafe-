import "server-only";
/**
 * Selling by weight (0075): the sizes sold by the kilo. Null before the owner
 * applies 0075: Products & Recipes then offers nothing of it.
 */
import { db, str, type Row } from "./client";

export async function getWeighedSizes(): Promise<Set<string> | null> {
  const c = await db();
  const r = await c.from("product_variant").select("id").eq("sold_by_weight", true);
  if (r.error) return null;
  return new Set(((r.data ?? []) as Row[]).map((x) => str(x.id)));
}
