import "server-only";
/**
 * Security fixes (0099): where each place is, for clocking from a phone; and
 * how long a till may sit untouched before it locks. Null before 0099.
 */
import { db } from "./client";

export interface ClockSpot {
  placeId: string;
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
  radius: number;
}

export async function getClockSpots(): Promise<ClockSpot[] | null> {
  const c = await db();
  const r = await c
    .from("location")
    .select("id,name,kind,is_active,clock_lat,clock_lng,clock_radius_m")
    .eq("is_active", true)
    .order("created_at");
  if (r.error) return null;
  return ((r.data ?? []) as Record<string, unknown>[]).map((l) => ({
    placeId: String(l.id),
    name: String(l.name),
    kind: String(l.kind),
    lat: l.clock_lat === null || l.clock_lat === undefined ? null : Number(l.clock_lat),
    lng: l.clock_lng === null || l.clock_lng === undefined ? null : Number(l.clock_lng),
    radius: Number(l.clock_radius_m ?? 150),
  }));
}

/** The minutes a till may sit untouched before it locks (0 is never); 0 before 0099. */
export async function getTillLockMinutes(locationId: string | null): Promise<number> {
  const c = await db();
  const r = await c.rpc("till_lock_minutes", { p_location: locationId });
  if (r.error) return 0;
  const v = Number(r.data ?? 0);
  return Number.isFinite(v) && v > 0 ? Math.min(v, 60) : 0;
}
