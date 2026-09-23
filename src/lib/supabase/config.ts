/**
 * Where the app finds its Supabase project.
 *
 * There is deliberately no fallback. The app used to ship one project's URL
 * and key as defaults, so a developer running it locally wrote to the live
 * business database without knowing (audit, "Secrets and environment
 * separation"). Now a deployment without these variables shows a setup notice
 * instead of quietly talking to someone else's books.
 *
 * The anon key is public by design: it identifies the project, and grants
 * nothing on its own. Every read and write is authorised by the signed-in
 * person's session (row-level security and permission-checked functions).
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
