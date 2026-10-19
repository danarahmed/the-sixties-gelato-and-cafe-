import "server-only";
/** Equipment (0081); null before it is applied: nothing shown. */
import { db } from "./client";
import { assetBoard, type AssetBoard } from "@/lib/equipment";

export async function getEquipment(): Promise<AssetBoard | null> {
  const c = await db();
  const { data, error } = await c.rpc("fixed_assets");
  if (error) return null;
  return assetBoard(data);
}

/** What the owner has put in and taken out, all told (0081); null before it. */
export async function getOwnerMoney(): Promise<{ putIn: number; takenOut: number } | null> {
  const c = await db();
  const { data, error } = await c.rpc("owner_money");
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return { putIn: Number(r.put_in ?? 0), takenOut: Number(r.taken_out ?? 0) };
}
