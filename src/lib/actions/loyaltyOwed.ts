"use server";
/**
 * Loyalty points as money owed (0113): the owner's switch. On again brings the
 * books to the points held at the reward's value now. The database checks who
 * may, and posts the journals.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { loyaltyOwedFrom, type LoyaltyOwed } from "@/lib/loyaltyOwed";

export async function setLoyaltyOwedAction(input: {
  enabled: boolean;
}): Promise<ActionResult<LoyaltyOwed>> {
  const v = parse(z.object({ enabled: z.boolean() }), input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("set_loyalty_owed", { p_enabled: v.data.enabled });
  if (!r.ok) return r;
  refresh("/settings", "/journals", "/reports", "/accounting");
  return { ok: true, data: loyaltyOwedFrom(r.data) };
}
