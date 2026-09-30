import "server-only";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import { v5 as uuidv5 } from "uuid";
import { createServerSupabase, NotConfiguredError } from "@/lib/supabase/server";
import { UNCERTAIN_MESSAGE, isUncertainFailure, rpcLogLine } from "./rpcOutcome";

/**
 * Every change to the books is ONE call to a database function that checks
 * the person's permission and commits everything it does together, or nothing
 * (audit C-06). The app never writes a table directly — it cannot: signed-in
 * users hold no write grant on any table.
 */
export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  /** `uncertain`: no answer came back, so it may have been saved (see rpcOutcome.ts). */
  | { ok: false; error: string; uncertain?: boolean };

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
 * Either is written to the app's log, so what people are refused can be seen.
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
    const { data, error, status } = await client.rpc(fn, args);
    if (error) {
      if (isUncertainFailure(error, status)) {
        console.warn(rpcLogLine(fn, "uncertain", { code: error.code, status }));
        return { ok: false, uncertain: true, error: UNCERTAIN_MESSAGE };
      }
      const said = friendlyError(error);
      console.warn(rpcLogLine(fn, "refused", { code: error.code, status, message: said }));
      return { ok: false, error: said };
    }
    return { ok: true, data: data as T };
  } catch {
    console.warn(rpcLogLine(fn, "uncertain"));
    return { ok: false, uncertain: true, error: UNCERTAIN_MESSAGE };
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

const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every write carries the key of the submission it belongs to (0035): the
 * screen makes it when the person submits and sends it again with every retry,
 * so the database records the write once. A write without one is refused here.
 */
export function badKey(key: unknown): { ok: false; error: string } | null {
  return typeof key === "string" && KEY.test(key)
    ? null
    : { ok: false, error: "This screen sent no retry key: reload the page and try again." };
}

/**
 * The key of a second write made by the same submission: always the same for
 * that submission and that write, and never the key of the first.
 */
export function subKey(key: string, step: string): string {
  return uuidv5(step, key);
}
