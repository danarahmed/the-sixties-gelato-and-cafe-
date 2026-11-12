import "server-only";
/** What the café owes its suppliers in dollars (0103); null before it, or for anyone else. */
import { db } from "./client";

export interface DollarsOwed {
  usd: number;
  value: number;
  lastRate: number | null;
  lastAt: string | null;
}

export async function getDollarsOwed(): Promise<DollarsOwed | null> {
  const c = await db();
  const r = await c.rpc("dollars_owed");
  if (r.error || !r.data) return null;
  const d = r.data as Record<string, unknown>;
  return {
    usd: Number(d.usd ?? 0),
    value: Number(d.value ?? 0),
    lastRate: d.last_rate == null ? null : Number(d.last_rate),
    lastAt: d.last_at == null ? null : String(d.last_at),
  };
}
