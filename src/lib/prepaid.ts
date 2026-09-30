/**
 * Prepaid expenses (0060, the September audit's P2-14), as the screens handle
 * them. Pure: Expenses and the tests read through here.
 *
 * A cost paid ahead for months to come is paid into 1400 Prepaid expenses,
 * and each month it covers takes its share as an expense of that month: an
 * equal share rounded down to whole dinars, the last what is left, so the
 * shares add up to what was paid. The database posts the same shares
 * (prepaid_shares); the form shows them before anything is sent.
 */
import Decimal from "decimal.js";

/**
 * How many months one covers: one only if it is still to come (next month's
 * rent); this month alone is an expense. More than three years is not expected.
 */
export const PREPAID_MONTHS = { min: 1, max: 36 } as const;

/** A month as "YYYY-MM". */
export type Month = string;

/** The month n months after (or before) a "YYYY-MM" month. */
export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export interface PrepaidShare {
  month: Month;
  amount: number;
}

/**
 * Each month's share of an amount paid ahead for `months` months from
 * `first`: equal, rounded down to whole dinars, the last taking what is left.
 * Empty when it cannot be spread (no whole dinar a month, or months out of
 * range).
 */
export function prepaidShares(amount: number, months: number, first: Month): PrepaidShare[] {
  if (!Number.isInteger(months) || months < PREPAID_MONTHS.min || months > PREPAID_MONTHS.max)
    return [];
  const total = new Decimal(amount);
  if (!total.isFinite() || total.lt(months)) return [];
  const each = total.div(months).floor();
  return Array.from({ length: months }, (_, i) => ({
    month: addMonths(first, i),
    amount: i < months - 1 ? each.toNumber() : total.minus(each.times(months - 1)).toNumber(),
  }));
}

/**
 * Why the form cannot record it yet, as the database would refuse it: a
 * phrase and its values, or null when it can. `thisMonth` is the café's.
 */
export function prepaidRefusal(
  amount: number,
  months: number,
  first: Month,
  thisMonth: Month,
): { text: string; vars?: Record<string, number> } | null {
  if (!Number.isInteger(months) || months < PREPAID_MONTHS.min || months > PREPAID_MONTHS.max)
    return { text: "Say how many months it covers, 1 to 36" };
  if (first < thisMonth) return { text: "Choose the first month it covers" };
  if (months === 1 && first === thisMonth)
    return { text: "For this month alone, record an expense" };
  if (!(amount >= months))
    return {
      text: "Each month takes at least 1 of it: pay at least {1}, or cover fewer months",
      vars: { 1: months },
    };
  return null;
}

/** A prepaid expense as the database lists it (prepaid_expenses). */
export interface PrepaidRow {
  id: string;
  description: string;
  accountCode: string;
  accountName: string;
  paidFrom: string;
  amount: number;
  firstMonth: Month;
  lastMonth: Month;
  months: number;
  createdAt: string;
  journalNo: number | null;
  location: string | null;
  /** The shares posted so far, and what they took out of 1400. */
  released: number;
  releasedAmount: number;
  /** Shares posted and then reversed by hand: theirs is back in 1400. */
  reversed: number;
  /** Shares whose month has come and are not posted yet. */
  due: number;
  /** The first month not posted yet; none once all are. */
  nextMonth: Month | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

export function prepaidFrom(r: Record<string, unknown>): PrepaidRow {
  return {
    id: String(r.id),
    description: String(r.description ?? ""),
    accountCode: String(r.account_code ?? ""),
    accountName: String(r.account_name ?? ""),
    paidFrom: String(r.paid_from ?? ""),
    amount: num(r.amount),
    firstMonth: String(r.first_month ?? ""),
    lastMonth: String(r.last_month ?? ""),
    months: num(r.months),
    createdAt: String(r.created_at ?? ""),
    journalNo: r.journal_no == null ? null : Number(r.journal_no),
    location: r.location == null ? null : String(r.location),
    released: num(r.released),
    releasedAmount: num(r.released_amount),
    reversed: num(r.reversed),
    due: num(r.due),
    nextMonth: r.next_month == null ? null : String(r.next_month),
    cancelledAt: r.cancelled_at == null ? null : String(r.cancelled_at),
    cancelReason: r.cancel_reason == null ? null : String(r.cancel_reason),
  };
}

/** What is still in 1400 for one: nothing once cancelled. */
export function stillAhead(p: PrepaidRow): number {
  return p.cancelledAt ? 0 : new Decimal(p.amount).minus(p.releasedAmount).toNumber();
}
