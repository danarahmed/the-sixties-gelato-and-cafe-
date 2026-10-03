/**
 * What a period's reports say, from their own figures: the period against
 * the one just before it, of as many days; where each 1,000 IQD of net
 * revenue went; the largest expense. Pure: the reports page reads the
 * figures and gives them here, and a test can give its own.
 */
import type { PnlRow } from "@/lib/db/reports";
import { addDays, daysBetween } from "@/lib/dates";

/** The days just before a period, as many as it has: before 1–31 October, 31 August to 30 September. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const days = Math.max(daysBetween(from, to), 0) + 1;
  const prevTo = addDays(from, -1);
  return { from: addDays(prevTo, -(days - 1)), to: prevTo };
}

/** A change from one figure to another, as a fraction (0.12 is 12% more); null when there was nothing before. */
export function change(now: number, before: number): number | null {
  if (!before || before <= 0) return null;
  return (now - before) / before;
}

/** The parts net revenue is spent on, in the order they are drawn. */
export const SPENT_ON = ["goods", "platforms", "waste", "staff", "running"] as const;
export type SpentOn = (typeof SPENT_ON)[number];

/** Which part an account belongs to: what was sold, the platforms, stock lost, the staff, the rest. */
export function spentOn(row: PnlRow): SpentOn | null {
  if (row.section === "revenue") return null;
  if (row.code === "5000") return "goods";
  if (row.code === "5100" || row.code === "5200") return "platforms";
  if (row.section === "cost_of_sales") return "waste"; // 5050, 5300, 5310, 5400
  if (row.code === "6100" || row.code === "6110") return "staff";
  return "running";
}

export interface Spending {
  revenue: number;
  /** Each part's amount and its share of each 1,000 IQD of net revenue. */
  parts: { key: SpentOn; amount: number; perThousand: number }[];
  /** What was kept (a profit) or lost, per 1,000 IQD too. */
  net: number;
  netPerThousand: number;
}

/**
 * Where each 1,000 IQD of net revenue went: what was sold cost, what the
 * platforms took, stock lost (waste, preparation, counts, price differences
 * on deliveries), the staff, the rest of the running costs; and what was
 * kept. None without net revenue: there is nothing to divide.
 */
export function spending(rows: PnlRow[]): Spending | null {
  const revenue = rows.filter((r) => r.section === "revenue").reduce((s, r) => s + r.amount, 0);
  if (revenue <= 0) return null;
  const amounts = new Map<SpentOn, number>(SPENT_ON.map((k) => [k, 0]));
  for (const r of rows) {
    const k = spentOn(r);
    if (k) amounts.set(k, (amounts.get(k) ?? 0) + r.amount);
  }
  const per = (n: number) => (n / revenue) * 1000;
  const parts = SPENT_ON.map((key) => ({
    key,
    amount: amounts.get(key) ?? 0,
    perThousand: per(amounts.get(key) ?? 0),
  }));
  const net = revenue - parts.reduce((s, p) => s + p.amount, 0);
  return { revenue, parts, net, netPerThousand: per(net) };
}

/** The operating expense that cost the most, or null when there is none. */
export function largestExpense(rows: PnlRow[]): PnlRow | null {
  let best: PnlRow | null = null;
  for (const r of rows)
    if (r.section === "operating_expenses" && r.amount > 0 && (!best || r.amount > best.amount))
      best = r;
  return best;
}

/** A share as a whole percentage, for words: 0.124 → 12. */
export function pct(part: number, whole: number): number | null {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

/**
 * A share as it is written beside a figure: "12", or "<1" for a share that
 * is there but rounds to nothing — never "0" for something that was spent.
 */
export function pctText(part: number, whole: number): string | null {
  const p = pct(part, whole);
  if (p === null) return null;
  return p === 0 && part > 0 ? "<1" : String(p);
}
