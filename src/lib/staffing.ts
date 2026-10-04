/**
 * Staffed when busy? (round six): the orders of each hour of the café's week
 * against the people on the clock in it, over four weeks. Where each person
 * on the clock served half as many orders again as usual, or more, in one of
 * the busier hours, the hour was short of hands; where two or more were on
 * the clock and each served half the usual or less, it was quiet; where
 * orders came and nobody was clocked in, the clock was not kept. Pure: the
 * page and the tests read through here.
 */
import { addDays } from "./dates";

/** Each person served half as many orders again as usual, or more: short of hands. */
export const SHORT = 1.5;
/** Each served half the usual, or less, with two or more on the clock: quiet. */
export const QUIET = 0.5;
/** Orders with nobody on the clock, on average a day, before it is said. */
const UNCLOCKED_AT_LEAST = 0.5;

/** The café's weekday of a day, as the sales analysis counts it: 0 Saturday … 6 Friday. */
export function cafeWeekday(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 1) % 7;
}

/** How many of each weekday (0 Saturday … 6 Friday) the days from `from` to `to` hold. */
export function weekdaysIn(from: string, to: string): number[] {
  const n = [0, 0, 0, 0, 0, 0, 0];
  for (let d = from; d <= to; d = addDays(d, 1)) n[cafeWeekday(d)]! += 1;
  return n;
}

/** A stretch someone was on the clock, as stored. */
export interface ClockSpan {
  clockIn: string;
  clockOut: string;
}

/** The café's day and hour at an instant. */
export type LocalClock = (at: number) => { day: string; hour: number };

const QUARTER = 15 * 60_000;

/**
 * The minutes people were on the clock in each hour of the café's week, on
 * the days from `from` to `to`, keyed "weekday|hour": each stretch cut at the
 * quarter hours (every time zone is a whole number of them from UTC), each
 * piece counted in the day and hour the café's clock showed.
 */
export function minutesOnClock(
  spans: ClockSpan[],
  from: string,
  to: string,
  local: LocalClock,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of spans) {
    const a = Date.parse(s.clockIn);
    const b = Date.parse(s.clockOut);
    if (!(b > a)) continue;
    for (let at = a; at < b;) {
      const next = Math.min(b, (Math.floor(at / QUARTER) + 1) * QUARTER);
      const { day, hour } = local(at);
      if (day >= from && day <= to) {
        const key = `${cafeWeekday(day)}|${hour}`;
        out.set(key, (out.get(key) ?? 0) + (next - at) / 60_000);
      }
      at = next;
    }
  }
  return out;
}

/** What the sales analysis says of an hour of the week, over all the days read. */
export interface HourSales {
  weekday: number;
  hour: number;
  orders: number;
  net: number;
}

export type HourFlag = "short" | "quiet" | "nobody";

/** An hour of the week, a day on average over its weekday's days. */
export interface HourOfWeek {
  weekday: number;
  hour: number;
  orders: number;
  net: number;
  /** People on the clock in the hour. */
  people: number;
  /** Orders each person on the clock served in it; null with nobody on it. */
  perHead: number | null;
  flag: HourFlag | null;
}

export interface Staffing {
  /** Each hour of the week with orders or people on the clock: Saturday first, then by hour. */
  hours: HourOfWeek[];
  /**
   * The orders a person on the clock usually serves in an hour: every order
   * served with someone on the clock, over every hour on the clock.
   */
  usual: number | null;
  /** The busier half of the hours begins here: the middle of their orders. */
  busy: number;
  /** The first and the last hour of the day with orders or people, on any weekday. */
  first: number | null;
  last: number | null;
  /** All the orders, those with nobody on the clock, and the hours on the clock, over the period. */
  orders: number;
  unclocked: number;
  personHours: number;
  /** How many of each weekday the period holds. */
  days: number[];
}

/** An hour's mark, from its orders and people on average and the usual. */
export function flagOf(
  orders: number,
  people: number,
  usual: number | null,
  busy: number,
): HourFlag | null {
  if (people <= 0) return orders >= UNCLOCKED_AT_LEAST ? "nobody" : null;
  if (usual === null || usual <= 0) return null;
  const each = orders / people;
  if (orders > 0 && orders >= busy && each >= SHORT * usual) return "short";
  if (people >= 2 && each <= QUIET * usual) return "quiet";
  return null;
}

/** The middle of a list of figures; 0 for none. */
function middle(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
}

/**
 * The café's week, hour by hour, over the days from `from` to `to`: the
 * orders and sales of each hour (the sales analysis by weekday, then hour)
 * against the minutes on the clock in it, each a day on average, and marked
 * where it was short of hands, quiet, or kept with nobody on the clock.
 */
export function staffing(
  sales: HourSales[],
  minutes: Map<string, number>,
  from: string,
  to: string,
): Staffing {
  const days = weekdaysIn(from, to);
  const cells = new Map<
    string,
    { weekday: number; hour: number; orders: number; net: number; minutes: number }
  >();
  const cell = (weekday: number, hour: number) => {
    const key = `${weekday}|${hour}`;
    let c = cells.get(key);
    if (!c) {
      c = { weekday, hour, orders: 0, net: 0, minutes: 0 };
      cells.set(key, c);
    }
    return c;
  };
  for (const s of sales) {
    if (!days[s.weekday]) continue;
    const c = cell(s.weekday, s.hour);
    c.orders += s.orders;
    c.net += s.net;
  }
  for (const [key, m] of minutes) {
    const [w, h] = key.split("|").map(Number) as [number, number];
    if (!days[w] || m <= 0) continue;
    cell(w, h).minutes += m;
  }

  let orders = 0;
  let served = 0;
  let unclocked = 0;
  let personHours = 0;
  for (const c of cells.values()) {
    orders += c.orders;
    if (c.minutes > 0) {
      served += c.orders;
      personHours += c.minutes / 60;
    } else unclocked += c.orders;
  }
  const usual = personHours > 0 ? served / personHours : null;
  const average = [...cells.values()].map((c) => {
    const n = days[c.weekday]!;
    return {
      weekday: c.weekday,
      hour: c.hour,
      orders: c.orders / n,
      net: c.net / n,
      people: c.minutes / 60 / n,
      perHead: c.minutes > 0 ? c.orders / (c.minutes / 60) : null,
    };
  });
  const busy = middle(average.filter((h) => h.orders > 0).map((h) => h.orders));
  const hours: HourOfWeek[] = average
    .map((h) => ({ ...h, flag: flagOf(h.orders, h.people, usual, busy) }))
    .sort((a, b) => a.weekday - b.weekday || a.hour - b.hour);
  const open = hours.map((h) => h.hour);
  return {
    hours,
    usual,
    busy,
    first: open.length ? Math.min(...open) : null,
    last: open.length ? Math.max(...open) : null,
    orders,
    unclocked,
    personHours,
    days,
  };
}

/** One hour of a day as the chart draws it. */
export interface ProfileHour {
  hour: number;
  orders: number;
  net: number;
  people: number;
  /** What the people on the clock usually serve: the line the orders are read against. */
  expected: number | null;
  flag: HourFlag | null;
}

/**
 * A day hour by hour, from the first hour of the week with orders or people
 * to the last: one weekday's, or (weekday null) every day's on average.
 */
export function dayProfile(s: Staffing, weekday: number | null): ProfileHour[] {
  if (s.first === null || s.last === null) return [];
  const total = s.days.reduce((a, b) => a + b, 0);
  const out: ProfileHour[] = [];
  for (let hour = s.first; hour <= s.last; hour++) {
    const these = s.hours.filter(
      (h) => h.hour === hour && (weekday === null || h.weekday === weekday),
    );
    // Every day's: the weekdays' days added back up, over all the days.
    const sum = (f: (h: HourOfWeek) => number) =>
      weekday === null
        ? these.reduce((a, h) => a + f(h) * s.days[h.weekday]!, 0) / (total || 1)
        : these.reduce((a, h) => a + f(h), 0);
    const orders = sum((h) => h.orders);
    const people = sum((h) => h.people);
    out.push({
      hour,
      orders,
      net: sum((h) => h.net),
      people,
      expected: s.usual === null ? null : people * s.usual,
      flag: these[0]?.flag ?? null,
    });
  }
  if (weekday !== null) return out;
  // Every day's hours are marked among themselves: an average day's busier
  // half is not a busy weekday's.
  const busy = middle(out.filter((h) => h.orders > 0).map((h) => h.orders));
  return out.map((h) => ({ ...h, flag: flagOf(h.orders, h.people, s.usual, busy) }));
}

/** Hours of one weekday in a row with the same mark, as said in words. */
export interface HourGroup {
  flag: HourFlag;
  weekday: number;
  /** The first hour, and the hour after the last. */
  from: number;
  to: number;
  /** An hour on average, a day on average. */
  orders: number;
  net: number;
  people: number;
  /**
   * How much it matters: short, the orders above what those on the clock
   * usually serve; quiet, the hours on the clock beyond what the orders
   * needed; nobody, the orders. A day on average, the group's hours added.
   */
  weight: number;
}

/** The marked hours, each weekday's run of the same mark as one, the weightiest first. */
export function hourGroups(s: Staffing): HourGroup[] {
  const groups: HourGroup[] = [];
  let run: HourOfWeek[] = [];
  const close = () => {
    const first = run[0];
    if (!first?.flag) return;
    const n = run.length;
    const sum = (f: (h: HourOfWeek) => number) => run.reduce((a, h) => a + f(h), 0);
    const usual = s.usual ?? 0;
    groups.push({
      flag: first.flag,
      weekday: first.weekday,
      from: first.hour,
      to: run[n - 1]!.hour + 1,
      orders: sum((h) => h.orders) / n,
      net: sum((h) => h.net) / n,
      people: sum((h) => h.people) / n,
      weight:
        first.flag === "short"
          ? sum((h) => h.orders - usual * h.people)
          : first.flag === "quiet"
            ? sum((h) => h.people - (usual > 0 ? h.orders / usual : 0))
            : sum((h) => h.orders),
    });
  };
  for (const h of s.hours) {
    const prev = run[run.length - 1];
    if (prev && (prev.weekday !== h.weekday || prev.hour + 1 !== h.hour || prev.flag !== h.flag)) {
      close();
      run = [];
    }
    run.push(h);
  }
  close();
  const order: Record<HourFlag, number> = { short: 0, quiet: 1, nobody: 2 };
  return groups.sort((a, b) => order[a.flag] - order[b.flag] || b.weight - a.weight);
}

/** The hour with the most orders a day on average; null when none had any. */
export function busiestHour(s: Staffing): HourOfWeek | null {
  let best: HourOfWeek | null = null;
  for (const h of s.hours) if (h.orders > 0 && (!best || h.orders > best.orders)) best = h;
  return best;
}

/** An hour as the clock shows it: "08:00". */
export const hourText = (hour: number) => `${String(hour % 24).padStart(2, "0")}:00`;

/** A figure as said: a tenth under ten, whole above ("4.5", "12"). */
export function aboutText(n: number): string {
  const r = n < 10 ? Math.round(n * 10) / 10 : Math.round(n);
  return r.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
