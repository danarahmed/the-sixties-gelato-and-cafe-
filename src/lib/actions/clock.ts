"use server";
/**
 * Clocking in on your own phone, with the shop's code (0068). The owner makes
 * a device at the shop a clock screen; a manager links a person's phone; the
 * phone clocks its person in or out with the code the screen shows. The keys
 * stay in HTTP-only cookies on their devices and go only to the database.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import {
  phoneClockAnswerFrom,
  phoneLinkFrom,
  readCode,
  screenCheckFrom,
  shopCodeFrom,
  isKey,
  type PhoneClockAnswer,
  type PhoneLink,
  type ShopCode,
} from "@/lib/clock";
import {
  forgetScreenKey,
  keepPhoneKey,
  keepScreenKey,
  phoneKey,
  screenKey,
} from "@/lib/clockDevice";
import { id, text } from "@/lib/validation";
import { createServerSupabase } from "@/lib/supabase/server";

const CLOCK_PATHS = ["/staff", "/pos", "/clock", "/clock/screen"];

const screenInput = z.object({
  name: text("The clock screen's name", 60),
  locationId: id("where it is"),
});

/** This device made one of the shop's clock screens: it keeps its key. */
export async function registerClockScreenAction(
  input: z.input<typeof screenInput>,
): Promise<ActionResult<{ name: string }>> {
  const v = parse(screenInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("register_clock_screen", {
    p_location: v.data.locationId,
    p_name: v.data.name,
  });
  if (!r.ok) return r;
  const key = r.data.key;
  if (!isKey(key)) return { ok: false, error: "The database refused the change." };
  await keepScreenKey(key);
  refresh(...CLOCK_PATHS);
  return { ok: true, data: { name: String(r.data.name ?? v.data.name) } };
}

const removeInput = z.object({
  screenId: id("a clock screen"),
  reason: text("Why", 300),
});

/** A clock screen taken out of use, with why. This device forgets its key if it was that one. */
export async function removeClockScreenAction(
  input: z.input<typeof removeInput>,
): Promise<ActionResult<null>> {
  const v = parse(removeInput, input);
  if (!v.ok) return v;
  const r = await callRpc<null>("remove_clock_screen", {
    p_screen: v.data.screenId,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  const mine = await screenKey();
  if (mine) {
    const still = await callRpc<unknown>("clock_screen_check", { p_key: mine });
    if (still.ok && screenCheckFrom(still.data).screen === null) await forgetScreenKey();
  }
  refresh(...CLOCK_PATHS);
  return { ok: true, data: null };
}

/** The code this device shows now, if it is a clock screen; asked again as each one ends. */
export async function shopCodeAction(): Promise<ActionResult<ShopCode>> {
  const key = await screenKey();
  if (!key) {
    return {
      ok: true,
      data: { ok: false, error: "This device is not one of the shop's clock screens" },
    };
  }
  const r = await callRpc<unknown>("clock_screen_code", { p_key: key });
  if (!r.ok) return r;
  return { ok: true, data: shopCodeFrom(r.data, Date.now()) };
}

const personInput = z.object({ employeeId: id("someone who works here") });

/** A link to make a phone this person's: shown on Staff, good for ten minutes, once. */
export async function linkPhoneStartAction(
  input: z.input<typeof personInput>,
): Promise<ActionResult<PhoneLink>> {
  const v = parse(personInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("link_phone_start", { p_employee: v.data.employeeId });
  if (!r.ok) return r;
  return { ok: true, data: phoneLinkFrom(r.data) };
}

/** Whether a person's phone is linked yet: Staff asks while its link is shown. */
export async function phoneLinkedAction(
  input: z.input<typeof personInput>,
): Promise<ActionResult<{ linkedAt: string | null }>> {
  const v = parse(personInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("staff_phones");
  if (!r.ok) return r;
  const mine = (Array.isArray(r.data) ? r.data : []).find(
    (p) =>
      p &&
      typeof p === "object" &&
      (p as Record<string, unknown>).employee_id === v.data.employeeId,
  ) as Record<string, unknown> | undefined;
  return { ok: true, data: { linkedAt: mine ? String(mine.linked_at ?? "") : null } };
}

const unlinkInput = z.object({
  employeeId: id("someone who works here"),
  reason: text("Why", 300),
});

/** A person's phone theirs no longer (lost, or changed), with why. */
export async function unlinkPhoneAction(
  input: z.input<typeof unlinkInput>,
): Promise<ActionResult<null>> {
  const v = parse(unlinkInput, input);
  if (!v.ok) return v;
  const r = await callRpc<null>("unlink_phone", {
    p_employee: v.data.employeeId,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh("/staff", "/pos");
  return { ok: true, data: null };
}

/** The link opened on the phone: this phone is now the person's, and keeps its key. */
export async function linkPhoneFinishAction(
  link: string,
): Promise<ActionResult<{ ok: boolean; error: string | null; name: string | null }>> {
  if (!isKey(link)) {
    return {
      ok: true,
      data: {
        ok: false,
        error: "This link is not one of the café's: ask a manager for a new one",
        name: null,
      },
    };
  }
  const r = await callRpc<Record<string, unknown>>("link_phone_finish", { p_link: link });
  if (!r.ok) return r;
  if (r.data.ok !== true || !isKey(r.data.key)) {
    return {
      ok: true,
      data: { ok: false, error: String(r.data.error ?? ""), name: null },
    };
  }
  await keepPhoneKey(r.data.key);
  refresh("/clock", "/staff");
  return { ok: true, data: { ok: true, error: null, name: String(r.data.name ?? "") } };
}

const phoneClockInput = z.object({
  code: z.string().refine((c) => readCode(c) !== null, "Type the 6 digits the shop's screen shows"),
  direction: z.enum(["in", "out"], { message: "Clock in, or out" }),
});

/**
 * Clocking in or out on this phone, with the code the shop's screen shows. A
 * code that has changed is an answer, not a failure: the person is told.
 */
export async function clockByPhoneAction(
  input: z.input<typeof phoneClockInput>,
  key: string,
): Promise<ActionResult<PhoneClockAnswer>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(phoneClockInput, input);
  if (!v.ok) return v;
  const phone = await phoneKey();
  if (!phone) {
    return {
      ok: true,
      data: phoneClockAnswerFrom({
        ok: false,
        error: "This phone is not linked to anyone: a manager links it on Staff",
      }),
    };
  }
  const r = await callRpc<unknown>("clock_by_phone", {
    p_phone: phone,
    p_code: readCode(v.data.code),
    p_direction: v.data.direction,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  const a = phoneClockAnswerFrom(r.data);
  if (a.ok) refresh("/clock", "/staff");
  return { ok: true, data: a };
}

/**
 * Whoever is signed in on a clock screen signs out there, and the screen goes
 * on showing the code: its key is the device's, not theirs. A tablet by the
 * door is then nobody's way into the books. Only this device is signed out:
 * the owner stays signed in on their own phone.
 */
export async function signOutClockScreenAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/clock/screen");
}
