/**
 * A payment posted twice (the September audit's P2-14: "rent posted twice on
 * 24 Sep"): an expense to the same account, for the same amount, within three
 * days of one already posted is asked about before it is posted. The
 * dashboard's alert (duplicate_payment, 0029) finds the same among what was
 * posted; this asks before. Pure: Expenses, its actions and the tests read
 * through here.
 */
import { dateIn, daysBetween } from "@/lib/dates";

/** How many days apart two payments of the same may be and still be asked about. */
export const SAME_PAYMENT_DAYS = 3;

/** What the server answers when a payment like it is posted already. A phrase. */
export const SAME_PAYMENT =
  "A payment like this one is posted already: tick that it is another payment to post it";

/** A payment posted: an expense (a prepaid expense's share too), or a prepaid expense's payment. */
export interface PostedPayment {
  accountCode: string;
  amount: number;
  /** The day it is for, "YYYY-MM-DD". */
  date: string;
  journalNo: number | null;
  description: string;
}

/** What the server says when it asks: the phrase, and the payments like it. */
export type SamePaymentRefusal = { ok: false; error: string; same: PostedPayment[] };

/**
 * The payments posted to the same account, for the same amount, within
 * SAME_PAYMENT_DAYS of `date`. None while the form is not filled in.
 */
export function samePayments(
  posted: PostedPayment[],
  p: { accountCode: string; amount: number; date: string },
): PostedPayment[] {
  if (!/^\d{4}$/.test(p.accountCode) || !(p.amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date))
    return [];
  return posted.filter(
    (x) =>
      x.accountCode === p.accountCode &&
      Math.abs(x.amount - p.amount) < 0.005 &&
      Math.abs(daysBetween(x.date, p.date)) <= SAME_PAYMENT_DAYS,
  );
}

/**
 * What was posted, as samePayments reads it: the expenses not reversed, and the
 * prepaid expenses not cancelled, each on the day it was paid (in the café's
 * time).
 */
export function postedPayments(
  expenses: {
    accountCode: string;
    amount: number;
    date: string;
    journalNo: number | null;
    description: string;
    reversedBy: number | null;
  }[],
  prepaid: {
    accountCode: string;
    amount: number;
    createdAt: string;
    journalNo: number | null;
    description: string;
    cancelledAt: string | null;
  }[],
  timezone: string,
): PostedPayment[] {
  return [
    ...expenses
      .filter((e) => e.reversedBy === null && /^\d{4}$/.test(e.accountCode))
      .map((e) => ({
        accountCode: e.accountCode,
        amount: e.amount,
        date: e.date,
        journalNo: e.journalNo,
        description: e.description,
      })),
    ...prepaid
      .filter((p) => p.cancelledAt === null)
      .map((p) => ({
        accountCode: p.accountCode,
        amount: p.amount,
        date: dateIn(timezone, new Date(p.createdAt)),
        journalNo: p.journalNo,
        description: p.description,
      })),
  ];
}
