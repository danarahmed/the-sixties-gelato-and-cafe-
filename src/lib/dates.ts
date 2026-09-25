/**
 * Dates in the BUSINESS's timezone. A café in Erbil trades from midnight to
 * midnight Baghdad time; counting its day in UTC put the early hours of every
 * trading day into the day before (audit H-09). Every "today", every period
 * boundary and every date shown on a screen goes through here.
 */

/** YYYY-MM-DD of an instant, as a calendar date in `timezone`. */
export function dateIn(timezone: string, at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** The business's trading day right now. */
export function businessToday(timezone: string): string {
  return dateIn(timezone);
}

/** "YYYY-MM-DD HH:mm" of a stored timestamp, in the business's timezone. */
export function dateTimeIn(timezone: string, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * The instant a business day begins — midnight in `timezone` — as an ISO
 * string, for reading records by the business's own days.
 */
export function dayStart(day: string, timezone: string): string {
  const midnightUtc = Date.parse(`${day}T00:00:00Z`);
  let t = midnightUtc;
  // Twice: the zone's offset can differ either side of a change of clocks.
  for (let i = 0; i < 2; i++) {
    const local = Date.parse(
      `${dateTimeIn(timezone, new Date(t).toISOString()).replace(" ", "T")}:00Z`,
    );
    t -= local - midnightUtc;
  }
  return new Date(t).toISOString();
}

/** Calendar arithmetic on YYYY-MM-DD strings (no timezone involved). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function monthEnd(day: string): string {
  const d = new Date(`${monthStart(day)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function yearStart(day: string): string {
  return `${day.slice(0, 4)}-01-01`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD from a query string, or the fallback if it is not one. */
export function parseDay(value: string | string[] | undefined, fallback: string): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !ISO_DAY.test(v)) return fallback;
  return Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) ? fallback : v;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}
