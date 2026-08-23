/**
 * Supabase client using the PUBLIC anon key.
 *
 * The anon/publishable key is designed to be public — it ships in browser
 * bundles. Data is protected by Row-Level Security, not by hiding this key, so
 * committing the demo project's URL + anon key as fallback config is safe and
 * keeps the deployment self-configuring. Environment variables override the
 * fallbacks for a different project.
 *
 * NOTE: this reads the labelled DEMO business via the `demo_public_read` RLS
 * policies (migration 0009). When real user authentication is added, swap to a
 * per-request client carrying the user's JWT so `tenant_isolation` scopes rows.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pijtavaindwgisvxnuea.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpanRhdmFpbmR3Z2lzdnhudWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODgzMzcsImV4cCI6MjEwMzA2NDMzN30.O21_1Lx__KBat16afc8TBOdUFVyzl9_z8LTWjMNL5W8";

/** The demonstration business id seeded by supabase/seed/01_master.sql. */
export const DEMO_BUSINESS_ID = "00000000-0000-0000-0000-0000000000b1";

export function isDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let cached: SupabaseClient | null = null;

/** Memoised anon client (safe on server or client). */
export function getSupabase(): SupabaseClient | null {
  if (!isDbConfigured()) return null;
  if (cached) return cached;
  cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
