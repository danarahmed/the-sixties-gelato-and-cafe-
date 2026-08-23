/**
 * Server-only Supabase client using the service-role key.
 *
 * SECURITY: this key bypasses Row-Level Security and must NEVER reach the
 * browser. It is only imported by server components / route handlers. It is the
 * interim read path for demo screens until user authentication (JWT + RLS) is
 * wired — at which point screens switch to a per-user client that RLS scopes.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Whether the live database is configured via environment variables. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Returns a memoised admin client, or null when the DB is not configured. */
export function getAdminClient(): SupabaseClient | null {
  if (!isDbConfigured()) return null;
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}

/** The demonstration business id seeded by supabase/seed/01_master.sql. */
export const DEMO_BUSINESS_ID = "00000000-0000-0000-0000-0000000000b1";
