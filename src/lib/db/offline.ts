import "server-only";
/**
 * The till's key for what it keeps on the device (0101): the café's, for
 * those who sell. Null before 0101, or for anyone else: the till then keeps
 * as before.
 */
import { db } from "./client";

export async function getOfflineKey(): Promise<string | null> {
  const c = await db();
  const r = await c.rpc("offline_key");
  if (r.error || typeof r.data !== "string" || r.data.length < 40) return null;
  return r.data;
}
