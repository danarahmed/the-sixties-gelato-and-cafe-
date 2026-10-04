/**
 * The start of the day, step by step: what the morning needs before the doors
 * open — the drawer, the people due in, what to make, the deliveries due, what
 * to buy, the red alerts — worked out from what the screens already read.
 * Nothing here writes: each step opens where its work is done, and is ticked
 * on the page once it is.
 */

/** Someone working today, as the till's clock board reads them (0049). */
export interface DuePerson {
  employeeId: string;
  name: string;
  inSince: string | null;
  shiftStarts: string | null;
}

/**
 * Who is due in: everyone working today, once each (a person on two places'
 * boards counts once), split into those clocked in, those whose shift has
 * begun and who are not in yet (the longest waited for first), and those due
 * later (the soonest first). Someone with no shift today and not in is due
 * later, at no set time.
 */
export function dueIn<T extends DuePerson>(
  boards: T[][],
  now: Date,
): { inNow: T[]; late: T[]; later: T[] } {
  const seen = new Map<string, T>();
  for (const board of boards)
    for (const p of board) {
      const before = seen.get(p.employeeId);
      // Clocked in at one place counts over a row that has them out at another.
      if (!before || (before.inSince === null && p.inSince !== null)) seen.set(p.employeeId, p);
    }
  const all = [...seen.values()];
  const at = (p: T) => (p.shiftStarts ? new Date(p.shiftStarts).getTime() : Infinity);
  const inNow = all.filter((p) => p.inSince !== null);
  const out = all.filter((p) => p.inSince === null);
  return {
    inNow,
    late: out.filter((p) => at(p) <= now.getTime()).sort((a, b) => at(a) - at(b)),
    later: out
      .filter((p) => at(p) > now.getTime())
      .sort((a, b) => at(a) - at(b) || a.name.localeCompare(b.name)),
  };
}

/** A recipe of the day's plan (0046), as the start of the day reads it. */
export interface PlanLine {
  recipe: string;
  status: "make" | "enough" | "no_history";
  batches: number;
}

/** What the day's plan says to make still: batches to make, the most first. */
export function toMake<T extends PlanLine>(recipes: T[]): T[] {
  return recipes
    .filter((r) => r.status === "make" && r.batches > 0)
    .sort((a, b) => b.batches - a.batches || a.recipe.localeCompare(b.recipe));
}

/** A purchase order (0044), as the start of the day reads it. */
export interface DueOrder {
  status: string;
  expectedOn: string | null;
  poNo: number;
}

/**
 * The deliveries due by a day: orders approved or sent, still to come, expected
 * on it or before (those late first). An order with no date is not due.
 */
export function deliveriesDue<T extends DueOrder>(orders: T[], day: string): T[] {
  return orders
    .filter(
      (o) =>
        (o.status === "approved" || o.status === "sent") &&
        o.expectedOn !== null &&
        o.expectedOn <= day,
    )
    .sort((a, b) => (a.expectedOn ?? "").localeCompare(b.expectedOn ?? "") || a.poNo - b.poNo);
}

/** Whether the café is in the morning, when the start of the day is offered: before noon. */
export const isMorning = (hour: number): boolean => hour >= 4 && hour < 12;
