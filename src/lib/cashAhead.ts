/**
 * Cash ahead (0093, SMART_PLAN part 5): the next days of the café's money as
 * the database forecasts them, read for the screen. Pure: the page reads the
 * forecast and gives it here, and a test can give its own.
 */

/** A day ahead, at its end. */
export interface CashDay {
  day: string;
  safe: number;
  bank: number;
  card: number;
  total: number;
  /** The usual takings that weekday, the card money reaching the bank, the safe banked, what is paid out. */
  takings: number;
  cardToBank: number;
  banked: number;
  paid: number;
}

/** Something due or expected on a day. */
export interface CashEvent {
  day: string;
  /** A bill owed; a delivery or order still to be billed; a customer's invoice; a regular payment. */
  kind: "bill" | "to_bill" | "customer" | "regular";
  from: "bank" | "safe";
  /** Coming in above nothing, going out below. */
  amount: number;
  label: string;
  ref: string | null;
  due: string | null;
  every: "week" | "fortnight" | "month" | "quarter" | null;
}

/** A spell the bank or the safe would be below nothing, and what to do. */
export interface CashWarning {
  from: string;
  to: string;
  /** The day it is above nothing again; null when it is not within the days ahead. */
  until: string | null;
  account: "bank" | "safe";
  lowest: number;
  lowestOn: string;
  daysAhead: number;
  due: CashEvent[];
  action: "move" | "later" | "money_in";
  move: number | null;
  moveBy: string | null;
  later: CashEvent | null;
}

export interface CashAhead {
  asOf: string;
  daysAhead: number;
  now: { till: number; safe: number; card: number; bank: number; other: number };
  learnt: {
    /** Each weekday's usual takings, Monday first: the cash into the safe, the card money. */
    cashIn: number[];
    cardIn: number[];
    cardDays: number[];
    cardFee: number;
    bankDays: number[];
    bankShare: number;
    payDays: number[];
    payDelay: number;
    payFrom: "bank" | "safe";
  };
  days: CashDay[];
  events: CashEvent[];
  overdue: { label: string; ref: string | null; amount: number; due: string }[];
  warnings: CashWarning[];
}

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
const nums = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : []);

const KINDS = ["bill", "to_bill", "customer", "regular"] as const;
const EVERY = ["week", "fortnight", "month", "quarter"] as const;

function eventFrom(x: Record<string, unknown>): CashEvent {
  return {
    day: str(x.day),
    kind: KINDS.includes(x.kind as CashEvent["kind"]) ? (x.kind as CashEvent["kind"]) : "regular",
    from: x.from === "safe" ? "safe" : "bank",
    amount: num(x.amount),
    label: str(x.label),
    ref: strOrNull(x.ref),
    due: strOrNull(x.due),
    every: EVERY.includes(x.every as NonNullable<CashEvent["every"]>)
      ? (x.every as CashEvent["every"])
      : null,
  };
}

export function cashAheadFrom(r: Record<string, unknown> | null | undefined): CashAhead | null {
  if (!r || typeof r !== "object" || !Array.isArray(r.days)) return null;
  const now = (r.now ?? {}) as Record<string, unknown>;
  const l = (r.learnt ?? {}) as Record<string, unknown>;
  return {
    asOf: str(r.as_of),
    daysAhead: num(r.days_ahead),
    now: {
      till: num(now.till),
      safe: num(now.safe),
      card: num(now.card),
      bank: num(now.bank),
      other: num(now.other),
    },
    learnt: {
      cashIn: nums(l.cash_in),
      cardIn: nums(l.card_in),
      cardDays: nums(l.card_days),
      cardFee: num(l.card_fee),
      bankDays: nums(l.bank_days),
      bankShare: num(l.bank_share),
      payDays: nums(l.pay_days),
      payDelay: num(l.pay_delay),
      payFrom: l.pay_from === "safe" ? "safe" : "bank",
    },
    days: list(r.days).map((d) => ({
      day: str(d.day),
      safe: num(d.safe),
      bank: num(d.bank),
      card: num(d.card),
      total: num(d.total),
      takings: num(d.takings),
      cardToBank: num(d.card_to_bank),
      banked: num(d.banked),
      paid: num(d.paid),
    })),
    events: list(r.events).map(eventFrom),
    overdue: list(r.overdue).map((o) => ({
      label: str(o.label),
      ref: strOrNull(o.ref),
      amount: num(o.amount),
      due: str(o.due),
    })),
    warnings: list(r.warnings).map((w) => ({
      from: str(w.from),
      to: str(w.to),
      until: strOrNull(w.until),
      account: w.account === "safe" ? "safe" : "bank",
      lowest: num(w.lowest),
      lowestOn: str(w.lowest_on),
      daysAhead: num(w.days_ahead),
      due: list(w.due).map(eventFrom),
      action: w.action === "move" ? "move" : w.action === "later" ? "later" : "money_in",
      move: numOrNull(w.move),
      moveBy: strOrNull(w.move_by),
      later:
        w.later && typeof w.later === "object"
          ? eventFrom(w.later as Record<string, unknown>)
          : null,
    })),
  };
}

/** The lowest the bank comes to in the days ahead, and when; null with no days. */
export function lowestBank(days: CashDay[]): { amount: number; day: string } | null {
  if (days.length === 0) return null;
  return days.reduce((low, d) => (d.bank < low.amount ? { amount: d.bank, day: d.day } : low), {
    amount: days[0]!.bank,
    day: days[0]!.day,
  });
}

/** What goes out in the days ahead, and what comes in besides the takings, summed. */
export function sums(events: CashEvent[]): { out: number; in: number } {
  return events.reduce(
    (s, e) => (e.amount < 0 ? { ...s, out: s.out - e.amount } : { ...s, in: s.in + e.amount }),
    { out: 0, in: 0 },
  );
}
