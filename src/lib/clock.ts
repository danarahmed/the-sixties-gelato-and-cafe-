/**
 * Clocking in on your own phone, with the shop's code (0068, round eight):
 * the shapes the screens read and the words they show. A clock screen at the
 * shop shows a code of 6 digits, and its square to scan, that changes every
 * half-minute; a person's own phone, linked once by a manager, scans it and
 * clocks them in or out. Pure: the pages, the forms and the tests read
 * through here.
 */
import { latinDigits } from "@/lib/validation";

/** The digits of a shop's code. */
export const CODE_DIGITS = 6;

/** What this device is: a clock screen, and whether the café has any. */
export interface ScreenCheck {
  /** The database has clock screens (0068 applied). */
  ready: boolean;
  /** The café has a clock screen: the till's clock is only on one now. */
  inUse: boolean;
  /** This device, when it is one of them. */
  screen: { id: string; name: string; location: string } | null;
}

/**
 * The code a clock screen shows now, until when, and how many seconds that is
 * by the server's clock (a till's own clock may be wrong); or why it shows none.
 */
export type ShopCode =
  | { ok: true; code: string; until: string; left: number; name: string; location: string }
  | { ok: false; error: string };

/** What a phone is, by its key: whose, and whether they are in. */
export type PhoneStatus =
  | { linked: false }
  | {
      linked: true;
      name: string;
      title: string | null;
      works: boolean;
      inSince: string | null;
      inAt: string | null;
      business: string;
      timezone: string;
    };

/** One of the café's clock screens, for Staff. */
export interface ClockScreen {
  id: string;
  name: string;
  locationId: string;
  location: string;
  createdAt: string;
  createdBy: string | null;
  lastSeenAt: string | null;
}

/** A person's linked phone, for Staff. */
export interface LinkedPhone {
  linkedAt: string;
  lastUsedAt: string | null;
}

/** A link for a manager to show, to make a phone someone's. */
export interface PhoneLink {
  key: string;
  until: string;
  name: string;
}

/** What clocking in or out on a phone answered: done, or why not. */
export interface PhoneClockAnswer {
  ok: boolean;
  error: string | null;
  name: string | null;
  clockIn: string | null;
  clockOut: string | null;
  minutes: number | null;
  lateMinutes: number | null;
  earlyMinutes: number | null;
  location: string | null;
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);

export function screenCheckFrom(v: unknown): ScreenCheck {
  const o = obj(v);
  const s = o.screen && typeof o.screen === "object" ? obj(o.screen) : null;
  return {
    ready: true,
    inUse: o.in_use === true,
    screen: s ? { id: str(s.id), name: str(s.name), location: str(s.location) } : null,
  };
}

/** Before 0068 is applied: no clock screens, the till clocks as it always has. */
export const NO_SCREENS: ScreenCheck = { ready: false, inUse: false, screen: null };

export function shopCodeFrom(v: unknown, now: number): ShopCode {
  const o = obj(v);
  if (o.ok !== true) return { ok: false, error: str(o.error) || "No code" };
  return {
    ok: true,
    code: str(o.code),
    until: str(o.until),
    left: secondsLeft(str(o.until), now),
    name: str(o.name),
    location: str(o.location),
  };
}

export function phoneStatusFrom(v: unknown): PhoneStatus {
  const o = obj(v);
  if (o.linked !== true) return { linked: false };
  return {
    linked: true,
    name: str(o.name),
    title: strOrNull(o.title),
    works: o.works === true,
    inSince: strOrNull(o.in_since),
    inAt: strOrNull(o.in_at),
    business: str(o.business),
    timezone: str(o.timezone) || "Asia/Baghdad",
  };
}

export function clockScreensFrom(v: unknown): ClockScreen[] {
  return list(v).map((r) => ({
    id: str(r.id),
    name: str(r.name),
    locationId: str(r.location_id),
    location: str(r.location),
    createdAt: str(r.created_at),
    createdBy: strOrNull(r.created_by),
    lastSeenAt: strOrNull(r.last_seen_at),
  }));
}

/** Whose phones are linked: by the person. */
export function linkedPhonesFrom(v: unknown): Record<string, LinkedPhone> {
  const out: Record<string, LinkedPhone> = {};
  for (const r of list(v)) {
    out[str(r.employee_id)] = { linkedAt: str(r.linked_at), lastUsedAt: strOrNull(r.last_used_at) };
  }
  return out;
}

export function phoneLinkFrom(v: unknown): PhoneLink {
  const o = obj(v);
  return { key: str(o.key), until: str(o.until), name: str(o.name) };
}

export function phoneClockAnswerFrom(v: unknown): PhoneClockAnswer {
  const o = obj(v);
  return {
    ok: o.ok === true,
    error: strOrNull(o.error),
    name: strOrNull(o.name),
    clockIn: strOrNull(o.clock_in),
    clockOut: strOrNull(o.clock_out),
    minutes: numOrNull(o.minutes),
    lateMinutes: numOrNull(o.late_minutes),
    earlyMinutes: numOrNull(o.early_minutes),
    location: strOrNull(o.location),
  };
}

/**
 * A code as someone typed it, in any digits, spaces and all: its 6 digits, or
 * null while it is not 6 digits.
 */
export function readCode(typed: string | null | undefined): string | null {
  const digits = latinDigits(String(typed ?? "")).replace(/[\s-]/g, "");
  return new RegExp(`^[0-9]{${CODE_DIGITS}}$`).test(digits) ? digits : null;
}

/** "482 913": a code as the screen shows it, easy to read across a room. */
export function spacedCode(code: string): string {
  return code.length === CODE_DIGITS ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** Where the square on a clock screen takes a phone: its clock, with the code. */
export function clockUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/clock?c=${encodeURIComponent(code)}`;
}

/** Where the square on Staff takes a phone: to be made someone's. */
export function linkUrl(origin: string, key: string): string {
  return `${origin.replace(/\/+$/, "")}/clock/link?k=${encodeURIComponent(key)}`;
}

/** Whole seconds from now until a moment, never below zero. */
export function secondsLeft(until: string, now: number): number {
  const t = Date.parse(until);
  return Number.isFinite(t) ? Math.max(0, Math.ceil((t - now) / 1000)) : 0;
}

/** A key as the database gives one out: 48 hex digits. */
export function isKey(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{48}$/.test(v);
}

/** Every phrase the database may answer a phone or a screen with: each is in the books. */
export const CLOCK_ANSWERS = [
  "This device is not one of the shop's clock screens",
  "This link is not one of the café's: ask a manager for a new one",
  "This link was used already: ask a manager for a new one",
  "This link is more than ten minutes old: ask a manager for a new one",
  "{1} does not work here now",
  "Clocking in and out is on the shop's clock screen",
  "{1} clocks in and out on their own phone, with the shop's code",
  "This phone is not linked to anyone: a manager links it on Staff",
  "Too many wrong codes from this phone: try again in 10 minutes",
  "That code has changed: scan the shop's code again",
] as const;
