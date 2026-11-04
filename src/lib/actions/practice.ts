"use server";
/**
 * Practice (0096): begun, begun again from the first day, and stopped. The
 * practice café is made by the database; here only the cookie that makes
 * every later call say it is practice.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { callRpc, type ActionResult } from "@/lib/db/rpc";
import { PRACTICE_COOKIE, practiceStateFrom, type PracticeState } from "@/lib/practice";

async function practiseOn(on: boolean) {
  const store = await cookies();
  if (on)
    // A session cookie: closing the app ends practice. Not httpOnly: the till
    // reads it to keep a practice sale held offline apart from real ones.
    store.set(PRACTICE_COOKIE, "1", { path: "/", sameSite: "lax" });
  else store.delete(PRACTICE_COOKIE);
}

/** Practice begun (their practice café made the first time), then on to its tasks. */
export async function startPracticeAction(): Promise<ActionResult<PracticeState>> {
  const r = await callRpc<unknown>("practice_start");
  if (!r.ok) return r;
  await practiseOn(true);
  return { ok: true, data: practiceStateFrom(r.data) };
}

/** A fresh practice café, as on the first day; what was ticked stays ticked. */
export async function resetPracticeAction(): Promise<ActionResult<PracticeState>> {
  const r = await callRpc<unknown>("practice_reset");
  if (!r.ok) return r;
  await practiseOn(true);
  return { ok: true, data: practiceStateFrom(r.data) };
}

/** Back to the café: nothing of practice comes with them. */
export async function stopPracticeAction(): Promise<void> {
  await practiseOn(false);
  redirect("/practice");
}
