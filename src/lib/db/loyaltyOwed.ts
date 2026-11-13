import "server-only";
/** Loyalty points as money owed (0113); null before 0113, or for someone who may not read it. */
import { db } from "./client";
import { loyaltyOwedFrom, type LoyaltyOwed } from "@/lib/loyaltyOwed";

export type { LoyaltyOwed };

export async function getLoyaltyOwed(): Promise<LoyaltyOwed | null> {
  const c = await db();
  const r = await c.rpc("loyalty_owed");
  if (r.error) return null;
  return loyaltyOwedFrom(r.data);
}
