/**
 * The exceptions report (0028, the audit's P1-10): every void, refund,
 * discount, cancelled bill, line taken off a bill and wrong PIN, by person,
 * and what waits for the owner's review. Pure: the screen, the CSV and the
 * tests read through here.
 */

/** What an exception was. */
export type ExceptionKind =
  | "void"
  | "refund"
  | "discount"
  | "bill_cancel"
  | "printed_bill_reduced"
  | "line_removed"
  | "wrong_pin";

export const EXCEPTION_LABEL: Record<ExceptionKind, string> = {
  void: "Void",
  refund: "Refund",
  discount: "Discount",
  bill_cancel: "Bill cancelled",
  printed_bill_reduced: "Printed bill reduced",
  line_removed: "Items taken off a bill",
  wrong_pin: "Wrong PIN",
};

/** One void, refund, discount, cancelled bill, line taken off or wrong PIN, and who. */
export interface ExceptionRow {
  at: string;
  kind: ExceptionKind;
  personId: string | null;
  person: string | null;
  /** Money involved; none for a bill never paid or a PIN. */
  amount: number | null;
  reason: string | null;
  /** A second person who approved it; null when nobody else did. */
  approvedBy: string | null;
  /** Waits for the owner: a void or refund nobody else approved, a wrong PIN, an unchecked discount. */
  needsReview: boolean;
  reference: string;
  detail: string | null;
}

/** Each person's exceptions, counted by kind, with the money involved and what waits for review. */
export interface PersonExceptions {
  person: string;
  counts: Partial<Record<ExceptionKind, number>>;
  amount: number;
  review: number;
}

export function exceptionsByPerson(list: ExceptionRow[]): PersonExceptions[] {
  const by = new Map<string, PersonExceptions>();
  for (const e of list) {
    const key = e.person ?? "No one signed in";
    const p = by.get(key) ?? { person: key, counts: {}, amount: 0, review: 0 };
    p.counts[e.kind] = (p.counts[e.kind] ?? 0) + 1;
    p.amount += e.amount ?? 0;
    if (e.needsReview) p.review += 1;
    by.set(key, p);
  }
  return [...by.values()].sort((a, b) => b.review - a.review || a.person.localeCompare(b.person));
}
