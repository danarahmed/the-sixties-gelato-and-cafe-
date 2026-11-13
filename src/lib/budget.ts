/**
 * Budgets and comparisons (0117), as Reports → Compare reads them: each
 * revenue and cost account this period, the same days a year before, and the
 * budget of the dates; and the three totals the owner decides on.
 */
import type { PnlRow } from "@/lib/db/reports";

export interface CompareRow {
  code: string;
  name: string;
  section: PnlRow["section"];
  now: number;
  lastYear: number;
  budget: number | null;
}

/** The same day a year before; 29 February is the 28th. */
export function yearBefore(day: string): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function compareRows(
  now: PnlRow[],
  lastYear: PnlRow[],
  budget: Map<string, number> | null,
): CompareRow[] {
  const before = new Map(lastYear.map((r) => [r.code, r.amount]));
  return now
    .map((r) => ({
      code: r.code,
      name: r.name,
      section: r.section,
      now: r.amount,
      lastYear: before.get(r.code) ?? 0,
      budget: budget ? (budget.get(r.code) ?? 0) : null,
    }))
    .filter((r) => r.now !== 0 || r.lastYear !== 0 || (r.budget ?? 0) !== 0);
}

export interface CompareTotals {
  revenue: number;
  grossProfit: number;
  net: number;
}

export function compareTotals(rows: CompareRow[], pick: (r: CompareRow) => number): CompareTotals {
  const sum = (s: PnlRow["section"]) =>
    rows.filter((r) => r.section === s).reduce((t, r) => t + pick(r), 0);
  const revenue = sum("revenue");
  const gross = revenue - sum("cost_of_sales");
  return { revenue, grossProfit: gross, net: gross - sum("operating_expenses") };
}

/** One figure against another, as a whole percentage; null when there is nothing to compare with. */
export function change(now: number, then: number): number | null {
  if (then === 0) return null;
  return Math.round(((now - then) / Math.abs(then)) * 100);
}
