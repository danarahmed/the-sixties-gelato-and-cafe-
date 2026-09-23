import "server-only";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import { createServerSupabase, NotConfiguredError } from "@/lib/supabase/server";

/**
 * Every change to the books is ONE call to a database function that checks
 * the person's permission and commits everything it does together, or nothing
 * (audit C-06). The app never writes a table directly — it cannot: signed-in
 * users hold no write grant on any table.
 */
export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

/** A database error, in words the person at the screen can act on. */
export function friendlyError(e: Pick<PostgrestError, "code" | "message">): string {
  const msg = e.message ?? "";
  if (e.code === "PGRST202" || e.code === "42883") {
    return "The database is missing an update this screen needs (a migration has not been applied yet).";
  }
  if (e.code === "28000") return "Your session has ended. Sign in again.";
  if (e.code === "42501") {
    // Our functions explain themselves; PostgreSQL's own denials do not.
    return /^permission denied for/i.test(msg) ? "You do not have permission to do that." : msg;
  }
  if (e.code === "23505") return "That has already been recorded.";
  if (e.code === "PGRST301" || e.code === "PGRST302")
    return "Your session has ended. Sign in again.";
  return msg || "The database refused the change.";
}

/**
 * Call one database function as the signed-in person. A refusal comes back as
 * a readable error, and nothing was written (the function's transaction
 * rolled back). A failure to reach the database is reported as uncertain.
 */
export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<ActionResult<T>> {
  let client;
  try {
    client = await createServerSupabase();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof NotConfiguredError ? e.message : "Could not start a database session.",
    };
  }
  try {
    const { data, error } = await client.rpc(fn, args);
    if (error) return { ok: false, error: friendlyError(error) };
    return { ok: true, data: data as T };
  } catch {
    return {
      ok: false,
      error:
        "The database could not be reached, so this may not have been saved. Refresh and check before trying again.",
    };
  }
}

/** Validate a form's input before it goes anywhere near the database. */
export function parse<T>(schema: ZodType<T>, input: unknown): ActionResult<T> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  return { ok: false, error: first?.message ?? "Check the form and try again." };
}

/** Refresh the screens a change affects. */
export function refresh(...paths: string[]): void {
  for (const p of paths) revalidatePath(p);
}
