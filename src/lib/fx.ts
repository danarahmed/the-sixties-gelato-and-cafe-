/**
 * US dollars at the till (0043, release R), as the screens handle them: the
 * rate a manager set, what dollars are worth in dinars, the change, a payment
 * partly in dollars, and the report. Pure: the till, Settings, Sales and the
 * tests read through here. The database works each figure out again, and its
 * answer is the one recorded.
 */
import Decimal from "decimal.js";
import { normaliseNumber } from "@/lib/validation";
import type { Payment } from "@/lib/payments";

/** The dollar notes in use, largest first. */
export const USD_NOTES = [100, 50, 20, 10, 5, 1] as const;

/** A rate as it was set: dinars a dollar, when, by whom and why. */
export interface FxRateSet {
  rate: number;
  setAt: string;
  setBy: string | null;
  reason: string;
}

/** The dollar as the till and Settings are told about it (fx_status). */
export interface FxStatus {
  /** Dinars a dollar; null when none was ever set. */
  rate: number | null;
  setAt: string | null;
  setBy: string | null;
  reason: string | null;
  /** Whole hours since it was set. */
  ageHours: number | null;
  /** Older than this, dollars are refused until a manager sets today's. */
  maxAgeHours: number;
  /** A rate is set, and recent enough to take dollars at. */
  usable: boolean;
  /** Dollars are counted in dinars to the nearest this. */
  roundTo: number;
  /** The reader may set the rate (fx.rate). */
  maySet: boolean;
  /** The last rates, newest first. */
  history: FxRateSet[];
}

const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);

export function fxStatusFrom(r: Record<string, unknown> | null | undefined): FxStatus {
  const d = r ?? {};
  return {
    rate: numOrNull(d.rate),
    setAt: strOrNull(d.set_at),
    setBy: strOrNull(d.set_by),
    reason: strOrNull(d.reason),
    ageHours: numOrNull(d.age_hours),
    maxAgeHours: Number(d.max_age_hours ?? 36),
    usable: d.usable === true,
    roundTo: Number(d.round_to ?? 250) || 250,
    maySet: d.may_set === true,
    history: Array.isArray(d.history)
      ? (d.history as Record<string, unknown>[]).map((h) => ({
          rate: Number(h.rate),
          setAt: String(h.set_at),
          setBy: strOrNull(h.set_by),
          reason: String(h.reason ?? ""),
        }))
      : [],
  };
}

/** What dollars are worth in dinars: at the rate, to the nearest step, half-way up (usd_value). */
export function usdValue(usd: number, rate: number, step: number): number {
  const s = step > 0 ? step : 1;
  return new Decimal(usd).times(rate).div(s).plus(0.5).floor().times(s).toNumber();
}

/** The fewest whole dollars worth at least the total. */
export function dollarsFor(total: number, rate: number, step: number): number {
  if (!(rate > 0) || !(total > 0)) return 0;
  let n = Math.max(1, Math.floor(total / rate));
  while (usdValue(n, rate, step) < total) n++;
  while (n > 1 && usdValue(n - 1, rate, step) >= total) n--;
  return n;
}

/** Dollars a customer is likely to hand over for this total: the fewest that do, then round sums above. */
export function suggestedDollars(total: number, rate: number, step: number): number[] {
  const need = dollarsFor(total, rate, step);
  if (need <= 0) return [];
  const out = new Set<number>([need]);
  for (const note of [5, 10, 20, 50, 100]) out.add(Math.ceil(need / note) * note);
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

/** Whole dollars (or dinars) as typed: "" when nothing was, null when not a whole number. */
export function wholeNumber(text: string): number | "" | null {
  const v = normaliseNumber(text);
  if (v === "") return "";
  return /^\d+$/.test(v) ? Number(v) : null;
}

/** How the rest is paid when the dollars do not cover the total. */
export type RestWay = "cash" | "card";

export type DollarProblem =
  /** Dollars, or the dinars handed over for the rest, are not a whole number. */
  | "notNumber"
  /** No dollars typed yet. */
  | "none"
  /** The dinars handed over for the rest are less than the rest. */
  | "restShort";

export interface DollarCheck {
  usd: number | null;
  /** What the dollars are worth, in dinars. */
  value: number | null;
  /** Dinars to give back, when the dollars pay it all. */
  change: number | null;
  /** What the dollars leave to pay, in dinars, another way. */
  rest: number;
  /** The dinars handed over for the rest in cash, and their change. */
  restReceived: number | null;
  restChange: number | null;
  problem: DollarProblem | null;
  /** The payments to send, when there is no problem. */
  payments: Payment[] | null;
}

/**
 * A payment in dollars as the till takes it: the dollars handed over, at the
 * rate shown. Worth the total or more, they pay it all and the change is in
 * dinars; worth less, they pay what they are worth and the rest is paid in
 * dinars or by card.
 */
export function checkDollars(
  total: number,
  rate: number,
  step: number,
  usdText: string,
  restWay: RestWay,
  restReceivedText: string,
): DollarCheck {
  const typed = wholeNumber(usdText);
  const none: DollarCheck = {
    usd: null,
    value: null,
    change: null,
    rest: total,
    restReceived: null,
    restChange: null,
    problem: typed === null ? "notNumber" : "none",
    payments: null,
  };
  if (typed === null || typed === "" || typed === 0) return none;
  const value = usdValue(typed, rate, step);
  const usd = { type: "cash" as const, currency: "USD" as const, usd: typed, rate, received: null };
  if (value >= total) {
    return {
      usd: typed,
      value,
      change: value - total,
      rest: 0,
      restReceived: null,
      restChange: null,
      problem: null,
      payments: [{ ...usd, amount: total }],
    };
  }
  const rest = total - value;
  const r = restWay === "cash" ? wholeNumber(restReceivedText) : "";
  const restReceived = typeof r === "number" ? r : null;
  const problem: DollarProblem | null =
    r === null ? "notNumber" : restReceived !== null && restReceived < rest ? "restShort" : null;
  return {
    usd: typed,
    value,
    change: null,
    rest,
    restReceived,
    restChange: restReceived !== null && restReceived >= rest ? restReceived - rest : null,
    problem,
    payments: problem
      ? null
      : [
          { ...usd, amount: value },
          { type: restWay, amount: rest, received: restWay === "cash" ? restReceived : null },
        ],
  };
}

/** What the database says when a rate is missing, too old or changed: the till reads the rate again. */
export const RATE_REFUSED =
  /^(No dollar rate is set|The dollar rate was set \d+ hours ago|The dollar rate is now )/;

/** The dollars' report (report_dollars). */
export interface DollarsReport {
  rate: { rate: number | null; setAt: string | null; setBy: string | null; reason: string | null };
  taken: { sales: number; usd: number; value: number; paid: number; change: number };
  byRate: { rate: number; sales: number; usd: number; value: number }[];
  rates: FxRateSet[];
  exchanges: {
    id: string;
    at: string;
    from: "till" | "safe";
    to: "till" | "safe" | "bank";
    usd: number;
    value: number;
    received: number;
    difference: number;
    rate: number;
    note: string | null;
    by: string | null;
    journalNo: number | null;
  }[];
  counts: {
    sessionId: string;
    sessionNo: number | null;
    at: string;
    location: string;
    expected: number;
    /** Null: the close did not count them; they stayed in the till. */
    counted: number | null;
    variance: number | null;
    varianceValue: number;
    taken: number;
    takenValue: number;
  }[];
  differences: { exchanges: number; counts: number };
  held: {
    tills: { locationId: string; location: string; usd: number; value: number }[];
    safe: { usd: number; value: number };
  };
}

export function dollarsReportFrom(r: Record<string, unknown> | null | undefined): DollarsReport {
  const d = r ?? {};
  const o = (v: unknown) => (v ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const rate = o(d.rate);
  const taken = o(d.taken);
  const held = o(d.held);
  const safe = o(held.safe);
  return {
    rate: {
      rate: numOrNull(rate.rate),
      setAt: strOrNull(rate.set_at),
      setBy: strOrNull(rate.set_by),
      reason: strOrNull(rate.reason),
    },
    taken: {
      sales: Number(taken.sales ?? 0),
      usd: Number(taken.usd ?? 0),
      value: Number(taken.value ?? 0),
      paid: Number(taken.paid ?? 0),
      change: Number(taken.change ?? 0),
    },
    byRate: list(d.by_rate).map((x) => ({
      rate: Number(x.rate),
      sales: Number(x.sales ?? 0),
      usd: Number(x.usd ?? 0),
      value: Number(x.value ?? 0),
    })),
    rates: list(d.rates).map((x) => ({
      rate: Number(x.rate),
      setAt: String(x.set_at),
      setBy: strOrNull(x.set_by),
      reason: String(x.reason ?? ""),
    })),
    exchanges: list(d.exchanges).map((x) => ({
      id: String(x.id),
      at: String(x.at),
      from: String(x.from) as "till" | "safe",
      to: String(x.to) as "till" | "safe" | "bank",
      usd: Number(x.usd ?? 0),
      value: Number(x.value ?? 0),
      received: Number(x.received ?? 0),
      difference: Number(x.difference ?? 0),
      rate: Number(x.rate ?? 0),
      note: strOrNull(x.note),
      by: strOrNull(x.by),
      journalNo: numOrNull(x.journal_no),
    })),
    counts: list(d.counts).map((x) => ({
      sessionId: String(x.session_id),
      sessionNo: numOrNull(x.session_no),
      at: String(x.at),
      location: String(x.location ?? ""),
      expected: Number(x.expected ?? 0),
      counted: numOrNull(x.counted),
      variance: numOrNull(x.variance),
      varianceValue: Number(x.variance_value ?? 0),
      taken: Number(x.taken ?? 0),
      takenValue: Number(x.taken_value ?? 0),
    })),
    differences: {
      exchanges: Number(o(d.differences).exchanges ?? 0),
      counts: Number(o(d.differences).counts ?? 0),
    },
    held: {
      tills: list(held.tills).map((x) => ({
        locationId: String(x.location_id),
        location: String(x.location ?? ""),
        usd: Number(x.usd ?? 0),
        value: Number(x.value ?? 0),
      })),
      safe: { usd: Number(safe.usd ?? 0), value: Number(safe.value ?? 0) },
    },
  };
}

/** "$20", as the screens and the receipt show dollars. */
export function fmtUSD(usd: number): string {
  return `$${usd.toLocaleString("en-US")}`;
}

/** "1,310": dinars a dollar, a rate, not an amount of money. */
export function fmtRate(rate: number): string {
  return rate.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
