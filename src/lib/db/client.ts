import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/** The signed-in person's database client for this request. */
export function db(): Promise<SupabaseClient> {
  return createServerSupabase();
}

/**
 * A read's rows — or an error the screen's error boundary shows. Never an
 * empty list standing in for a failure: "no data yet" and "could not load"
 * must look different (audit, usability: silent failure surfaces).
 */
export type Row = Record<string, unknown>;

export function rows<T = Row>(
  res: { data: unknown; error: PostgrestError | null },
  what: string,
): T[] {
  if (res.error) throw new Error(`Could not load ${what}: ${res.error.message}`);
  return (Array.isArray(res.data) ? res.data : []) as T[];
}

export function one<T = Row>(
  res: { data: unknown; error: PostgrestError | null },
  what: string,
): T | null {
  if (res.error) throw new Error(`Could not load ${what}: ${res.error.message}`);
  return (res.data ?? null) as T | null;
}

/** Numeric columns arrive as numbers (or strings for very large values). */
export function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : num(v);
}

export function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export function strOrNull(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}
