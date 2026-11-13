import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SESSION_COOKIE, supabaseConfig } from "./config";
import { PRACTICE_COOKIE, PRACTICE_HEADER, SUPPORT_COOKIE, SUPPORT_HEADER } from "@/lib/practice";

export class NotConfiguredError extends Error {
  constructor() {
    super("This deployment has no database configured.");
    this.name = "NotConfiguredError";
  }
}

/**
 * The Supabase client for ONE request, acting as the signed-in person. Their
 * session cookie carries the JWT that row-level security and every database
 * function check, so this client can see and do exactly what that person may —
 * nothing is scoped by the app itself. Create one per request; never share.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cfg = supabaseConfig();
  if (!cfg) throw new NotConfiguredError();
  const store = await cookies();
  // Practice (0096): every call says so, and the database answers as the
  // person's twin in their practice café.
  const practising = store.get(PRACTICE_COOKIE)?.value === "1";
  // Support (0109): the business looked at, when an administrator is allowed to.
  const support = store.get(SUPPORT_COOKIE)?.value ?? "";
  const supporting = /^[0-9a-f-]{36}$/i.test(support);
  const headers = {
    ...(practising ? { [PRACTICE_HEADER]: "1" } : {}),
    ...(supporting && !practising ? { [SUPPORT_HEADER]: support } : {}),
  };
  return createServerClient(cfg.url, cfg.anonKey, {
    cookieOptions: SESSION_COOKIE,
    ...(Object.keys(headers).length > 0 ? { global: { headers } } : {}),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // A Server Component cannot set cookies; the middleware refreshes
          // the session on every request, so nothing is lost here.
        }
      },
    },
  });
}
