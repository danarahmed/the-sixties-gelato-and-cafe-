/**
 * The week and the month at a glance: the seven days to a day against the
 * seven before them, or a month against the same days of the month before,
 * from the sales analysis (by day and by product, 0051) and the loss report
 * (0048). Pure: the page reads the figures and gives them here, and a test
 * can give its own.
 */
import { addDays, daysBetween, monthEnd, monthStart } from "@/lib/dates";
import { change } from "@/lib/insights";

export interface WeekWindow {
  from: string;
  to: string;
  beforeFrom: string;
  beforeTo: string;
}

/** The seven days ending on a day, and the seven before them. */
export function weekWindow(end: string): WeekWindow {
  return {
    from: addDays(end, -6),
    to: end,
    beforeFrom: addDays(end, -13),
    beforeTo: addDays(end, -7),
  };
}

/** A day's sales, as the analysis gives them by date. */
export interface DayFigures {
  day: string;
  net: number;
  cost: number;
  orders: number;
}

export interface WeekTotals {
  net: number;
  cost: number;
  /** Net sales less what they cost. */
  margin: number;
  orders: number;
  /** The margin as a share of net sales, to a tenth of a percent; null with no sales. */
  marginPct: number | null;
  /** What an order came to on average; null with no orders. */
  perOrder: number | null;
}

/** A week's figures, from its days. */
export function totals(days: DayFigures[]): WeekTotals {
  const net = days.reduce((s, d) => s + d.net, 0);
  const cost = days.reduce((s, d) => s + d.cost, 0);
  const orders = days.reduce((s, d) => s + d.orders, 0);
  return {
    net,
    cost,
    margin: net - cost,
    orders,
    marginPct: net > 0 ? Math.round(((net - cost) / net) * 1000) / 10 : null,
    perOrder: orders > 0 ? net / orders : null,
  };
}

/** The days of a window, from its first to its last. */
export function daysOf(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Each of the week's seven days with what it made, and what the same weekday made the week before. */
export function dayByDay(
  rows: DayFigures[],
  w: WeekWindow,
): { day: string; net: number; orders: number; before: string; beforeNet: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return daysOf(w.from, w.to).map((day) => {
    const before = addDays(day, -7);
    return {
      day,
      net: byDay.get(day)?.net ?? 0,
      orders: byDay.get(day)?.orders ?? 0,
      before,
      beforeNet: byDay.get(before)?.net ?? 0,
    };
  });
}

/** The week's figures, split from a fortnight's days: this week, and the one before. */
export function splitWeeks(
  rows: DayFigures[],
  w: WeekWindow,
): { now: WeekTotals; before: WeekTotals } {
  return {
    now: totals(rows.filter((r) => r.day >= w.from && r.day <= w.to)),
    before: totals(rows.filter((r) => r.day >= w.beforeFrom && r.day <= w.beforeTo)),
  };
}

/** A product's sales in a week. */
export interface ProductFigures {
  key: string;
  name: string;
  net: number;
}

export interface Mover {
  key: string;
  name: string;
  net: number;
  /** What it sold the week before; 0 when it sold nothing then. */
  before: number;
  /** As a fraction (0.4 is 40% more); null when it sold nothing the week before. */
  change: number | null;
}

/**
 * The products by what they sold this week, with the week before beside each;
 * and, of those sold both weeks, the one that rose the most and the one that
 * fell the most in dinars (a cup more of something small is no news).
 */
export function movers(
  now: ProductFigures[],
  before: ProductFigures[],
): { best: Mover[]; rise: Mover | null; fall: Mover | null } {
  const was = new Map(before.map((p) => [p.key, p]));
  const all: Mover[] = now.map((p) => {
    const b = was.get(p.key)?.net ?? 0;
    return { key: p.key, name: p.name, net: p.net, before: b, change: change(p.net, b) };
  });
  // Those sold the week before and not at all this week fell too.
  for (const p of before)
    if (!now.some((n) => n.key === p.key) && p.net > 0)
      all.push({ key: p.key, name: p.name, net: 0, before: p.net, change: -1 });
  const both = all.filter((m) => m.before > 0);
  const byGain = [...both].sort((a, b) => b.net - b.before - (a.net - a.before));
  const rise = byGain[0] && byGain[0].net > byGain[0].before ? byGain[0] : null;
  const last = byGain[byGain.length - 1];
  const fall = last && last.net < last.before ? last : null;
  return {
    best: all
      .filter((m) => m.net > 0)
      .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name)),
    rise,
    fall,
  };
}

/** The best day of the week or the month: the most sold, the latest first on a tie; null with no sales. */
export function bestDay<T extends { day: string; net: number }>(days: T[]): T | null {
  let best: T | null = null;
  for (const d of days) if (d.net > 0 && (!best || d.net >= best.net)) best = d;
  return best;
}

/**
 * A month: from its first day to its last, or to today while it runs; against
 * the same days of the month before while it runs, and all of the month
 * before once it is over.
 */
export interface MonthWindow extends WeekWindow {
  /** Its first day. */
  month: string;
  /** The first day of the month before. */
  beforeMonth: string;
  /** Its last day, and the month before's. */
  last: string;
  beforeLast: string;
  /** Whether it is over: the window runs to its last day. */
  whole: boolean;
}

/** The month a day falls in, to today at most, against the month before. */
export function monthWindow(day: string, today: string): MonthWindow {
  const month = monthStart(day);
  const last = monthEnd(month);
  const to = last < today ? last : today;
  const whole = to === last;
  const beforeMonth = monthStart(addDays(month, -1));
  const beforeLast = addDays(month, -1);
  // The same day of the month before; the 30th of March is the 28th of February.
  const same = `${beforeMonth.slice(0, 8)}${to.slice(8)}`;
  return {
    from: month,
    to,
    beforeFrom: beforeMonth,
    beforeTo: whole || same > beforeLast ? beforeLast : same,
    month,
    beforeMonth,
    last,
    beforeLast,
    whole,
  };
}

/** A day's place in its week, Monday first (0 to 6). */
export const weekdayIndex = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

/**
 * What each weekday sold on a usual day between two days: the average of the
 * days it sold anything (a day closed is no usual day). A weekday with none
 * has none.
 */
export function usualByWeekday(rows: DayFigures[], from: string, to: string): Map<number, number> {
  const sums = new Map<number, { total: number; days: number }>();
  for (const r of rows) {
    if (r.day < from || r.day > to || r.net <= 0) continue;
    const k = weekdayIndex(r.day);
    const s = sums.get(k) ?? { total: 0, days: 0 };
    s.total += r.net;
    s.days += 1;
    sums.set(k, s);
  }
  return new Map([...sums].map(([k, s]) => [k, s.total / s.days]));
}

/** Each day of the month with what it made, and what a usual day of its weekday made the month before. */
export function monthDayByDay(
  rows: DayFigures[],
  w: MonthWindow,
): { day: string; net: number; orders: number; usual: number | null }[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const usual = usualByWeekday(rows, w.beforeMonth, w.beforeLast);
  return daysOf(w.from, w.to).map((day) => ({
    day,
    net: byDay.get(day)?.net ?? 0,
    orders: byDay.get(day)?.orders ?? 0,
    usual: usual.get(weekdayIndex(day)) ?? null,
  }));
}

/**
 * Where a month still running closes at its pace: what its full days sold on
 * average, over all its days. Today is not a full day yet; null before a week
 * of full days, and for a month that is over.
 */
export function monthPace(
  rows: DayFigures[],
  w: MonthWindow,
  today: string,
): { projected: number; days: number } | null {
  if (w.whole) return null;
  const end = w.to === today ? addDays(today, -1) : w.to;
  const days = daysBetween(w.from, end) + 1;
  if (days < 7) return null;
  const sold = rows.filter((r) => r.day >= w.from && r.day <= end).reduce((s, r) => s + r.net, 0);
  return { projected: Math.round((sold / days) * (daysBetween(w.from, w.last) + 1)), days };
}

/** The weekday that sold the most on a usual day, and the one that sold the least; null with fewer than two. */
export function weekdaysApart(
  usual: Map<number, number>,
): { best: number; bestNet: number; worst: number; worstNet: number } | null {
  const all = [...usual].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const best = all[0];
  const worst = all[all.length - 1];
  if (!best || !worst || all.length < 2 || best[1] === worst[1]) return null;
  return { best: best[0], bestNet: best[1], worst: worst[0], worstNet: worst[1] };
}
