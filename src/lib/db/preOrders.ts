import "server-only";
/**
 * Pre-orders (0076), for the till and the kitchen. Null before the owner
 * applies 0076: the screens then show nothing of them.
 */
import { db } from "./client";
import { preOrderList, type PreOrderList } from "@/lib/preOrders";

export async function getPreOrders(location: string | null): Promise<PreOrderList | null> {
  const c = await db();
  const { data, error } = await c.rpc("pre_orders", { p_location: location });
  if (error) return null;
  return preOrderList(data);
}
