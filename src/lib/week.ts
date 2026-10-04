/**
 * The week at a glance: the seven days to a day against the seven before
 * them, from the sales analysis (by day and by product, 0051) and the loss
 * report (0048). Pure: the page reads the figures and gives them here, and a
 * test can give its own.
 */
import { addDays } from "@/lib/dates";
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

/** The best day of the week: the most sold, the latest first on a tie; null with no sales. */
export function bestDay<T extends { day: string; net: number }>(days: T[]): T | null {
  let best: T | null = null;
  for (const d of days) if (d.net > 0 && (!best || d.net >= best.net)) best = d;
  return best;
}
