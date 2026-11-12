import "server-only";
/**
 * The Speed page (plan 8, 0100): for the system's administrators only, never
 * a café's owner. False, or nothing, before 0100 and for anyone else.
 */
import { db } from "./client";

export interface SpeedCall {
  name: string;
  ms: number | null;
}

export interface SpeedSample {
  id: string;
  at: string;
  deviceMs: number | null;
  databaseMs: number | null;
  calls: SpeedCall[];
  agent: string | null;
  note: string | null;
}

export async function isSystemAdmin(): Promise<boolean> {
  const c = await db();
  const r = await c.rpc("is_system_admin");
  return !r.error && r.data === true;
}

export function callsFrom(v: unknown): SpeedCall[] {
  return (Array.isArray(v) ? v : []).map((x: Record<string, unknown>) => ({
    name: String(x?.name ?? ""),
    ms: typeof x?.ms === "number" ? x.ms : null,
  }));
}

export async function getSpeedSamples(): Promise<SpeedSample[]> {
  const c = await db();
  const r = await c.rpc("speed_samples", { p_limit: 30 });
  if (r.error || !Array.isArray(r.data)) return [];
  return (r.data as Record<string, unknown>[]).map((s) => ({
    id: String(s.id),
    at: String(s.at),
    deviceMs: typeof s.device_ms === "number" ? s.device_ms : null,
    databaseMs: typeof s.database_ms === "number" ? s.database_ms : null,
    calls: callsFrom(s.calls),
    agent: s.agent ? String(s.agent) : null,
    note: s.note ? String(s.note) : null,
  }));
}
