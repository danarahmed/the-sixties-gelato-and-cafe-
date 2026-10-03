/**
 * The end of the day, step by step: what is still open now — bills, drawers,
 * people clocked in, losses, money still to come, alerts — worked out from
 * what the screens already read. Nothing here writes: each step opens where
 * its work is done, and is ticked here once it is.
 */
import { sortAlerts, type Alert } from "@/lib/alerts";

export type StepState = "done" | "left";

/** Of the steps shown, how many are done; the day is ready to close once all are. */
export function progress(states: StepState[]): { done: number; total: number; ready: boolean } {
  const done = states.filter((s) => s === "done").length;
  return { done, total: states.length, ready: states.length > 0 && done === states.length };
}

/** The rules about money still to come: card takings not banked, a platform's not paid. */
export const MONEY_RULES: ReadonlySet<string> = new Set([
  "card_not_banked",
  "platform_not_received",
]);

/**
 * The alerts still waiting for someone (neither answered nor snoozed): the red
 * ones, the orange ones, and those about money still to come, of any colour.
 */
export function waitingAlerts(alerts: Alert[]): { red: Alert[]; orange: Alert[]; money: Alert[] } {
  const { needsYou } = sortAlerts(alerts);
  return {
    red: needsYou.filter((a) => a.urgency === "red"),
    orange: needsYou.filter((a) => a.urgency === "orange"),
    money: needsYou.filter((a) => MONEY_RULES.has(a.rule)),
  };
}

/** A cash session as the end of the day reads it. */
export interface DrawerSession {
  kind: string;
  isOpen: boolean;
  closedAt: string | null;
  counted: number | null;
  variance: number | null;
}

/** The drawers still open, oldest first. */
export function openDrawers<T extends DrawerSession & { openedAt: string }>(rows: T[]): T[] {
  return rows
    .filter((r) => r.kind === "session" && r.isOpen)
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
}

/**
 * The drawers closed on a day (by its date where the café is): how many, how
 * many of them were counted, and what the counts came to against what each
 * should have held (over is more than it should, short less).
 */
export function closedOn(
  rows: DrawerSession[],
  day: string,
  dayOf: (iso: string) => string,
): { closed: number; counted: number; difference: number } {
  const closed = rows.filter(
    (r) => r.kind === "session" && !r.isOpen && r.closedAt !== null && dayOf(r.closedAt) === day,
  );
  const counted = closed.filter((r) => r.counted !== null);
  return {
    closed: closed.length,
    counted: counted.length,
    difference: counted.reduce((s, r) => s + (r.variance ?? 0), 0),
  };
}

/** Everyone clocked in now, once each, the longest in first. */
export function stillIn<T extends { employeeId: string; inSince: string | null }>(
  boards: T[][],
): (T & { inSince: string })[] {
  const seen = new Map<string, T & { inSince: string }>();
  for (const board of boards)
    for (const p of board)
      if (p.inSince !== null && !seen.has(p.employeeId))
        seen.set(p.employeeId, p as T & { inSince: string });
  return [...seen.values()].sort((a, b) => a.inSince.localeCompare(b.inSince));
}

/** The first few of a list, and how many more there are. */
export function firstFew<T>(list: T[], shown = 3): { shown: T[]; more: number } {
  return { shown: list.slice(0, shown), more: Math.max(list.length - shown, 0) };
}
