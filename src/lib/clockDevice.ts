import "server-only";
/**
 * What a device keeps to clock with (0068): a clock screen's key, on the
 * device the owner made one, and a phone's key, on the phone a manager
 * linked. Each lives in an HTTP-only cookie, out of reach of any script in the
 * page, and is sent only to the database functions that ask for it.
 */
import { cookies, headers } from "next/headers";
import { isKey } from "@/lib/clock";

/** The clock screen's key, on the device that is one. */
export const SCREEN_COOKIE = "clock_screen";
/** The phone's key, on the phone linked to someone. */
export const PHONE_COOKIE = "clock_phone";
/** Browsers keep a cookie 400 days at most. */
const KEEP_SECONDS = 400 * 24 * 60 * 60;

async function read(name: string): Promise<string | null> {
  const v = (await cookies()).get(name)?.value ?? null;
  return isKey(v) ? v : null;
}

async function keep(name: string, key: string): Promise<void> {
  // Secure over https (the live site); a test server on http keeps it too.
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(name, key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: KEEP_SECONDS,
  });
}

/** This device's clock screen key, or none. */
export function screenKey(): Promise<string | null> {
  return read(SCREEN_COOKIE);
}

/** This phone's key, or none. */
export function phoneKey(): Promise<string | null> {
  return read(PHONE_COOKIE);
}

export function keepScreenKey(key: string): Promise<void> {
  return keep(SCREEN_COOKIE, key);
}

export async function forgetScreenKey(): Promise<void> {
  (await cookies()).delete(SCREEN_COOKIE);
}

export function keepPhoneKey(key: string): Promise<void> {
  return keep(PHONE_COOKIE, key);
}
