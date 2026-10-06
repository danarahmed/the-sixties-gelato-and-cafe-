import "server-only";
/**
 * The shop's clock screens and the staff's linked phones (0068), read through
 * the database functions that check who asks. Before 0068 is applied there
 * are none, and the screens say so rather than fail.
 */
import { db } from "./client";
import {
  NO_SCREENS,
  clockScreensFrom,
  linkedPhonesFrom,
  phoneStatusFrom,
  screenCheckFrom,
  type ClockScreen,
  type LinkedPhone,
  type PhoneStatus,
  type ScreenCheck,
} from "@/lib/clock";
import { phoneKey, screenKey } from "@/lib/clockDevice";

/** Whether this device is a clock screen, and whether the café has any. */
export async function getScreenCheck(): Promise<ScreenCheck> {
  const c = await db();
  const r = await c.rpc("clock_screen_check", { p_key: await screenKey() });
  if (r.error) return NO_SCREENS;
  return screenCheckFrom(r.data);
}

/** The café's clock screens; null before 0068 is applied. */
export async function getClockScreens(): Promise<ClockScreen[] | null> {
  const c = await db();
  const r = await c.rpc("clock_screens");
  if (r.error) return null;
  return clockScreensFrom(r.data);
}

/** Whose phones are linked, by the person; null before 0068 is applied. */
export async function getLinkedPhones(): Promise<Record<string, LinkedPhone> | null> {
  const c = await db();
  const r = await c.rpc("staff_phones");
  if (r.error) return null;
  return linkedPhonesFrom(r.data);
}

/** What this phone is: whose, and whether they are in. */
export async function getPhoneStatus(): Promise<PhoneStatus | null> {
  const key = await phoneKey();
  if (!key) return { linked: false };
  const c = await db();
  const r = await c.rpc("phone_status", { p_phone: key });
  if (r.error) return null;
  return phoneStatusFrom(r.data);
}
