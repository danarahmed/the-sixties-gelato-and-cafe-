import "server-only";
/**
 * Cash ahead (0093), as the signed-in person reads it (profit.view); none
 * before 0093 is applied.
 */
import { cashAheadFrom, type CashAhead } from "@/lib/cashAhead";
import { db } from "./client";

export async function getCashAhead(days = 30): Promise<CashAhead | null> {
  const c = await db();
  const r = await c.rpc("cash_ahead", { p_days: days });
  if (r.error) return null;
  return cashAheadFrom(r.data as Record<string, unknown> | null);
}
