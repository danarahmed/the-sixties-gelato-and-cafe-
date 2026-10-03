/**
 * What the dashboard says about today, from the sales analysis's own
 * figures (0051): how today compares with a usual day of its kind by this
 * time, when that kind of day is busiest, and what sells. Pure: the page
 * reads the figures and gives them here, and a test can give its own.
 *
 * "A usual Saturday" is the average of the four Saturdays before, as the
 * daily brief counts it, leaving out any on which nothing was sold (the café
 * closed). "By this time" takes the whole hours before now and the part of
 * this hour that has passed: today's sales so far are set against the same
 * stretch of a usual day, never against a whole one.
 */

/** A day's sales: net of discounts, as the analysis counts them. */
export interface DaySales {
  day: string;
  net: number;
  orders: number;
}

/** An hour of a day's sales: 0 to 23, in the café's own time. */
export interface HourSales {
  hour: number;
  net: number;
  orders: number;
}

export interface ProductSales {
  name: string;
  net: number;
  cost: number;
  margin: number;
  qty: number;
}

/** The days of the same weekday before a day, the nearest first. */
export function sameWeekdaysBefore(day: string, weeks = 4): string[] {
  const out: string[] = [];
  const d = new Date(`${day}T12:00:00Z`);
  for (let w = 1; w <= weeks; w++) {
    const p = new Date(d.getTime() - w * 7 * 86_400_000);
    out.push(p.toISOString().slice(0, 10));
  }
  return out;
}

/** A day's sales from the start of the day to a time: whole hours, and the passed part of the last. */
export function salesBy(
  hours: HourSales[],
  hour: number,
  minute: number,
): { net: number; orders: number } {
  let net = 0;
  let orders = 0;
  const part = Math.min(Math.max(minute, 0), 60) / 60;
  for (const h of hours) {
    if (h.hour < hour) {
      net += h.net;
      orders += h.orders;
    } else if (h.hour === hour) {
      net += h.net * part;
      orders += h.orders * part;
    }
  }
  return { net, orders };
}

export interface Pace {
  /** Today so far. */
  net: number;
  orders: number;
  /** A usual day of today's kind by the same time; null when there is none to go by. */
  usualNet: number | null;
  usualOrders: number | null;
  /** How many days the usual is the average of. */
  days: number;
  /** Today against the usual, as a fraction (0.12 is 12% more); null without a usual. */
  netChange: number | null;
  ordersChange: number | null;
}

/**
 * Today so far against a usual day of its kind by the same time. `past` holds
 * each earlier day of the same weekday, hour by hour; a day with no sales at
 * all is left out, as the café was closed.
 */
export function pace(today: HourSales[], past: HourSales[][], hour: number, minute: number): Pace {
  const net = today.reduce((s, h) => s + h.net, 0);
  const orders = today.reduce((s, h) => s + h.orders, 0);
  const open = past.filter((d) => d.some((h) => h.net !== 0 || h.orders !== 0));
  if (open.length === 0)
    return {
      net,
      orders,
      usualNet: null,
      usualOrders: null,
      days: 0,
      netChange: null,
      ordersChange: null,
    };
  const by = open.map((d) => salesBy(d, hour, minute));
  const usualNet = by.reduce((s, b) => s + b.net, 0) / open.length;
  const usualOrders = by.reduce((s, b) => s + b.orders, 0) / open.length;
  return {
    net,
    orders,
    usualNet,
    usualOrders,
    days: open.length,
    netChange: usualNet > 0 ? (net - usualNet) / usualNet : null,
    ordersChange: usualOrders > 0 ? (orders - usualOrders) / usualOrders : null,
  };
}

/** A usual day's sales hour by hour: the average of the days the café was open. */
export function usualHours(past: HourSales[][]): HourSales[] {
  const open = past.filter((d) => d.some((h) => h.net !== 0 || h.orders !== 0));
  if (open.length === 0) return [];
  const byHour = new Map<number, HourSales>();
  for (const d of open)
    for (const h of d) {
      const s = byHour.get(h.hour) ?? { hour: h.hour, net: 0, orders: 0 };
      s.net += h.net / open.length;
      s.orders += h.orders / open.length;
      byHour.set(h.hour, s);
    }
  return [...byHour.values()].sort((a, b) => a.hour - b.hour);
}

/** The hour a usual day sells the most in, or null when there is no usual day. */
export function busiestHour(usual: HourSales[]): number | null {
  let best: HourSales | null = null;
  for (const h of usual) if (h.net > 0 && (!best || h.net > best.net)) best = h;
  return best ? best.hour : null;
}

/** The hours to draw: from the first to the last any of the days sold in. */
export function hourSpan(...days: HourSales[][]): number[] {
  const hours = days
    .flat()
    .filter((h) => h.net !== 0 || h.orders !== 0)
    .map((h) => h.hour);
  if (hours.length === 0) return [];
  const from = Math.min(...hours);
  const to = Math.max(...hours);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** What part of its net a product keeps after what it used: 0.62 is 62%; null when it is not costed. */
export function kept(p: ProductSales): number | null {
  if (p.net <= 0 || p.cost <= 0) return null;
  return p.margin / p.net;
}

/** The products that brought in the most, at most `n`. */
export function topSellers(products: ProductSales[], n = 5): ProductSales[] {
  return products
    .filter((p) => p.net > 0)
    .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name))
    .slice(0, n);
}

/**
 * The product that keeps the least of what it sells for, when that is under
 * `below` (30%): one sold at least `minQty` times, and costed, so a missing
 * cost is never read as a fine margin.
 */
export function thinnestMargin(
  products: ProductSales[],
  below = 0.3,
  minQty = 3,
): (ProductSales & { kept: number }) | null {
  let worst: (ProductSales & { kept: number }) | null = null;
  for (const p of products) {
    const k = kept(p);
    if (k === null || p.qty < minQty || k >= below) continue;
    if (!worst || k < worst.kept) worst = { ...p, kept: k };
  }
  return worst;
}

/** A change as a whole percentage, for words: 0.124 → 12. */
export function percent(change: number): number {
  return Math.round(Math.abs(change) * 100);
}

/** Whether a change is worth saying: within 5% either way is "as usual". */
export function direction(change: number | null): "up" | "down" | "same" | null {
  if (change === null) return null;
  if (change >= 0.05) return "up";
  if (change <= -0.05) return "down";
  return "same";
}
