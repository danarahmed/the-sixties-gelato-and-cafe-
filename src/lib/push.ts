/**
 * Warnings on your phone (0072, round eleven): what a phone is sent, in its
 * own language. The database writes each warning as the dashboard's alerts
 * are written, in English; here it is put into the phone's language the way
 * the dashboard does it, and made the small message a phone shows. Pure: the
 * app's address (/api/push/send) and the tests read through here.
 */
import { builtInWords } from "@/lib/i18n/dictionaries";
import { messenger } from "@/lib/i18n/core";

/** A message waiting for a phone, as the database gives it (push_take). */
export interface WaitingMessage {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
  title: string;
  body: string | null;
  url: string;
  tag: string | null;
  urgent: boolean;
}

/** What the phone's service worker is given to show (public/sw.js). */
export interface PhonePayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  urgent: boolean;
  dir: "ltr" | "rtl";
  lang: string;
}

const LOCALES = new Set(["en", "ar", "ckb"]);
const byLocale = new Map<string, (s: string) => string>();

/** The dashboard's way of reading the database's words, in a language. */
function sayIn(locale: string): (s: string) => string {
  const l = LOCALES.has(locale) ? locale : "en";
  let say = byLocale.get(l);
  if (!say) {
    const dir = l === "en" ? "ltr" : "rtl";
    say = messenger(builtInWords(l), dir, l as "en" | "ar" | "ckb");
    byLocale.set(l, say);
  }
  return say;
}

/** Only the app's own pages are opened from a warning. */
export function safePath(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  return u.startsWith("/") && !u.startsWith("//") ? u : "/dashboard";
}

/** Short enough for a phone's banner: the whole of a word, then "…". */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max / 2 ? cut.slice(0, space) : cut}…`;
}

/** The message a phone is sent, in its language. */
export function phonePayload(m: WaitingMessage): PhonePayload {
  const locale = LOCALES.has(m.locale) ? m.locale : "en";
  const say = sayIn(locale);
  // A summary's list is the alerts' titles joined with "; ": each is read alone.
  const body = (m.body ?? "")
    .split("; ")
    .filter(Boolean)
    .map((part) => say(part))
    .join(" · ");
  return {
    title: clip(say(m.title), 120),
    body: clip(body, 240),
    url: safePath(m.url),
    tag: m.tag ?? `m${m.id}`,
    urgent: m.urgent,
    dir: locale === "en" ? "ltr" : "rtl",
    lang: locale === "ckb" ? "ckb" : locale,
  };
}

/** A push service's answer that means the phone is gone for good. */
export function isGone(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

/** The waiting messages, as the database's answer has them. */
export function waitingFrom(v: unknown): WaitingMessage[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      id: Number(x.id),
      endpoint: String(x.endpoint ?? ""),
      p256dh: String(x.p256dh ?? ""),
      auth: String(x.auth ?? ""),
      locale: String(x.locale ?? "en"),
      title: String(x.title ?? ""),
      body: x.body === null || x.body === undefined ? null : String(x.body),
      url: String(x.url ?? "/dashboard"),
      tag: x.tag === null || x.tag === undefined ? null : String(x.tag),
      urgent: x.urgent === true,
    }))
    .filter((m) => Number.isFinite(m.id) && m.endpoint.startsWith("https://"));
}

/** The phrases this file shows through t(): none; the database's words are read with msg(). */
export const PUSH_DB_MESSAGES: readonly string[] = [
  "{1} new warnings at the café",
  "A test from the café: warnings come to this phone",
  "They come within about five minutes of being seen.",
];

/** What the app's address needs, given rather than fetched, so it can be tried without a network. */
export interface PushRound {
  /** The database's queue and keys, for the secret it was given (push_take). */
  take: () => Promise<{
    subject: string;
    publicKey: string;
    privateKey: string;
    messages: WaitingMessage[];
  }>;
  /** Sends one message; resolves, or rejects with the push service's status code. */
  send: (
    m: WaitingMessage,
    payload: PhonePayload,
    keys: { subject: string; publicKey: string; privateKey: string },
  ) => Promise<void>;
  /** Tells the database what was sent and which phones are gone (push_done). */
  done: (sent: number[], gone: string[]) => Promise<void>;
}

/**
 * One round: take the queue, send each message in its phone's language (ten at
 * a time), and say what went and which phones are gone. What failed otherwise
 * stays in the queue, to be offered again.
 */
export async function pushRound(
  r: PushRound,
): Promise<{ sent: number; gone: number; failed: number }> {
  const { subject, publicKey, privateKey, messages } = await r.take();
  const keys = { subject, publicKey, privateKey };
  const sent: number[] = [];
  const gone = new Set<string>();
  let failed = 0;
  for (let i = 0; i < messages.length; i += 10) {
    const batch = messages.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map((m) => r.send(m, phonePayload(m), keys)));
    results.forEach((res, j) => {
      const m = batch[j]!;
      if (res.status === "fulfilled") sent.push(m.id);
      else if (isGone((res.reason as { statusCode?: number } | null)?.statusCode))
        gone.add(m.endpoint);
      else failed += 1;
    });
  }
  if (messages.length > 0) await r.done(sent, [...gone]);
  return { sent: sent.length, gone: gone.size, failed };
}
