"use server";
/**
 * Two-step sign-in (round twenty-three, 0080): a six-digit code from an
 * authenticator app after the password. Supabase Auth keeps the app's key;
 * the session says whether the code was given (aal2), and the database
 * refuses a session that has a second step but has not taken it.
 */
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/db/rpc";

const CODE = /^\d{6}$/;

/** Whether this person has a second step, and whether this session has taken it. */
export async function twoStepState(): Promise<{
  on: boolean;
  factorId: string | null;
  done: boolean;
}> {
  const supabase = await createServerSupabase();
  // One after the other: the list asks Supabase Auth who this is, so the
  // level after it reads a session already checked.
  const { data: list } = await supabase.auth.mfa.listFactors();
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const factor = list?.totp?.find((f) => f.status === "verified") ?? null;
  return {
    on: factor !== null,
    factorId: factor?.id ?? null,
    done: level?.currentLevel === "aal2",
  };
}

/** Begin turning it on: a new key for the authenticator app, as a QR code and as text. */
export async function startTwoStepAction(): Promise<
  ActionResult<{ factorId: string; qr: string; secret: string }>
> {
  const supabase = await createServerSupabase();
  // A step begun and never confirmed is taken off first: one at a time.
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? [])
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data)
    return { ok: false, error: "The second step could not be started. Try again." };
  return { ok: true, data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

/** The code the app shows, to confirm the key (turning it on) or to finish signing in. */
async function giveCode(factorId: string, code: string): Promise<ActionResult<null>> {
  if (!CODE.test(code.trim())) return { ok: false, error: "Type the six digits the app shows" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) return { ok: false, error: "That code is not right. Type the one the app shows now." };
  return { ok: true, data: null };
}

export async function confirmTwoStepAction(
  factorId: string,
  code: string,
): Promise<ActionResult<null>> {
  return giveCode(factorId, code);
}

/** Signing in: the code, then on to where they were going. */
export async function verifyTwoStepAction(
  _prev: { error: string | null },
  form: FormData,
): Promise<{ error: string | null }> {
  const state = await twoStepState();
  if (!state.factorId) redirect("/");
  const r = await giveCode(state.factorId, String(form.get("code") ?? ""));
  if (!r.ok) return { error: r.error };
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/");
}

/** Turning it off: only from a session that has taken it. */
export async function stopTwoStepAction(factorId: string): Promise<ActionResult<null>> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error)
    return { ok: false, error: "The second step could not be turned off. Sign in again and try." };
  return { ok: true, data: null };
}
