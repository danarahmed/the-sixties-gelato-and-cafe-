/**
 * Split payments (0042): a sale paid in parts, as the till takes it and a
 * refund gives it back, worked out as the database works it out. Amounts are
 * whole dinars. A cash payment may be in dollars (0043): its dollars and the
 * rate shown go with it, and the database works out what they are worth.
 */
import type { SaleReceipt } from "@/lib/actions/sales";
import { saleCustomerFrom } from "@/lib/customers";
import { normaliseNumber } from "@/lib/validation";

export type PayType = "cash" | "card" | "platform_paid";

/** One payment: its part of the sale; for cash, what was handed over (null: not typed). */
export interface Payment {
  type: PayType;
  amount: number;
  received: number | null;
  /** Cash in dollars (0043): the dollars handed over and the rate the till showed. */
  currency?: "USD";
  usd?: number;
  rate?: number;
}

/** A payment as the database recorded it, with the change it gave. */
export interface PaidPart {
  type: PayType;
  amount: number;
  /** In dinars; for dollars, what they were worth. */
  received: number | null;
  change: number | null;
  /** Cash in dollars (0043): how many, at what rate. */
  currency?: "USD";
  usd?: number;
  rate?: number;
}

/** A part of a split as the cashier typed it. The last one, left empty, takes what is left. */
export interface SplitRow {
  type: PayType;
  amount: string;
}

export type SplitProblem =
  /** An amount, or the cash handed over, is not a whole number. */
  | "notNumber"
  /** A part before the last has no amount. */
  | "missing"
  /** A part of nothing. */
  | "zero"
  /** The parts come to more than the total. */
  | "over"
  /** The parts come to less than the total. */
  | "short"
  /** The cash handed over is less than the cash part. */
  | "cashShort";

export interface SplitCheck {
  /** Each part as it will be sent: the last, when empty, is what is left. Null where unreadable. */
  amounts: (number | null)[];
  /** The total less the parts typed: what the last part takes when it is left empty. */
  rest: number;
  /** The parts come to more than the total by this, or less by this: never both. */
  over: number;
  short: number;
  /** The cash part, what was handed over for it (null: not typed), and the change. */
  cash: number | null;
  received: number | null;
  change: number | null;
  problem: SplitProblem | null;
  /** The payments to send, when there is no problem. */
  payments: Payment[] | null;
}

const WHOLE = /^\d+$/;

/** A whole number of dinars as typed; "" when nothing was, null when it is not one. */
function whole(text: string): number | "" | null {
  const v = normaliseNumber(text);
  if (v === "") return "";
  return WHOLE.test(v) ? Number(v) : null;
}

/**
 * A split as typed, checked as the database checks it: each part more than
 * nothing, together the total exactly; one cash part at most, and what was
 * handed over for it at least that part.
 */
export function checkSplit(total: number, rows: SplitRow[], receivedText: string): SplitCheck {
  let problem: SplitProblem | null = null;
  const typed = rows.map((r) => whole(r.amount));
  if (typed.some((x) => x === null)) problem = "notNumber";
  const sumTyped = typed.reduce<number>((s, x) => s + (typeof x === "number" ? x : 0), 0);
  const rest = total - sumTyped;
  const amounts = typed.map((x, i) => {
    if (x === null) return null;
    if (x !== "") return x;
    if (i === rows.length - 1) return rest;
    problem ??= "missing";
    return null;
  });
  if (!problem && amounts.some((x) => x !== null && x <= 0)) problem = rest < 0 ? "over" : "zero";
  const sum = amounts.reduce<number>((s, x) => s + (x ?? 0), 0);
  const over = Math.max(0, sum - total);
  const short = Math.max(0, total - sum);
  if (!problem && over > 0) problem = "over";
  if (!problem && short > 0) problem = "short";
  const cashAt = rows.findIndex((r) => r.type === "cash");
  const cash = cashAt >= 0 ? (amounts[cashAt] ?? null) : null;
  const r = whole(receivedText);
  const received = typeof r === "number" ? r : null;
  if (r === null) problem ??= "notNumber";
  if (received !== null && cash !== null && received < cash) problem ??= "cashShort";
  const change = received !== null && cash !== null && received >= cash ? received - cash : null;
  return {
    amounts,
    rest,
    over,
    short,
    cash,
    received,
    change,
    problem,
    payments: problem
      ? null
      : rows.map((row, i) => ({
          type: row.type,
          amount: amounts[i] ?? 0,
          received: i === cashAt ? received : null,
        })),
  };
}

/** The change a sale gave: each cash payment's, as the database recorded it. */
export function changeGiven(parts: readonly { change: number | null }[]): number | null {
  const c = parts.filter((p) => p.change !== null);
  return c.length === 0 ? null : c.reduce((s, p) => s + (p.change ?? 0), 0);
}

/** A payment from the database's answer. */
export function paidPart(x: Record<string, unknown>): PaidPart {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    type: String(x.type) as PayType,
    amount: Number(x.amount ?? 0),
    received: n(x.received),
    change: n(x.change),
    ...(x.currency === "USD"
      ? { currency: "USD" as const, usd: Number(x.usd ?? 0), rate: Number(x.rate ?? 0) }
      : {}),
  };
}

/** What is left of each way a sale was paid (refundable_payments), in the order it was first paid. */
export interface LeftToGiveBack {
  type: PayType;
  paid: number;
  left: number;
}

/**
 * What each way of paying took, less what refunds gave back of it. A refund
 * from before 0037 names no payment: it gave back the sale's one, the first.
 */
export function leftToGiveBack(
  paid: readonly { type: PayType; amount: number }[],
  back: readonly { type: PayType; amount: number }[],
  unnamedBack = 0,
): LeftToGiveBack[] {
  const out: LeftToGiveBack[] = [];
  for (const p of paid) {
    const had = out.find((x) => x.type === p.type);
    if (had) {
      had.paid += p.amount;
      had.left += p.amount;
    } else out.push({ type: p.type, paid: p.amount, left: p.amount });
  }
  for (const b of back) {
    const had = out.find((x) => x.type === b.type);
    if (had) had.left -= b.amount;
  }
  const first = out[0];
  if (first) first.left -= unnamedBack;
  return out;
}

/**
 * A refund shared over what is left of each payment, in proportion, in whole
 * dinars adding up to it exactly: the largest remainders take the odd dinars,
 * the first of equals first (the database's allocate_landed, for whole units).
 */
export function proportionalParts(lefts: readonly number[], amount: number): number[] {
  const w = lefts.map((x) => BigInt(Math.max(0, Math.round(x))));
  const total = w.reduce((s, x) => s + x, 0n);
  const a = BigInt(Math.max(0, Math.round(amount)));
  if (total <= 0n || a === 0n) return w.map(() => 0);
  const parts = w.map((x) => {
    const floor = (x * a) / total;
    return { floor, rem: x * a - floor * total };
  });
  let leftover = a - parts.reduce((s, p) => s + p.floor, 0n);
  const order = parts
    .map((p, i) => ({ ...p, i }))
    .sort((x, y) => (y.rem > x.rem ? 1 : y.rem < x.rem ? -1 : x.i - y.i));
  const out = parts.map((p) => p.floor);
  for (const o of order) {
    if (leftover <= 0n) break;
    out[o.i] = o.floor + 1n;
    leftover -= 1n;
  }
  return out.map(Number);
}

export type RefundSplitProblem =
  | { kind: "notNumber" }
  | { kind: "tooMuch"; type: PayType; left: number }
  | { kind: "sum"; sum: number };

/**
 * The parts of a refund as typed, one per way of paying (blank: nothing),
 * checked as the database checks them: each at most what is left of it,
 * together the refund.
 */
export function checkRefundSplit(
  left: readonly LeftToGiveBack[],
  typed: Record<string, string>,
  total: number,
): { parts: { type: PayType; amount: number }[]; problem: RefundSplitProblem | null } {
  const parts: { type: PayType; amount: number }[] = [];
  let problem: RefundSplitProblem | null = null;
  for (const l of left) {
    const v = whole(typed[l.type] ?? "");
    if (v === null) {
      problem ??= { kind: "notNumber" };
      continue;
    }
    if (v === "" || v === 0) continue;
    if (v > l.left) problem ??= { kind: "tooMuch", type: l.type, left: l.left };
    parts.push({ type: l.type, amount: v });
  }
  const sum = parts.reduce((s, p) => s + p.amount, 0);
  if (!problem && sum !== total) problem = { kind: "sum", sum };
  return { parts, problem };
}

/**
 * How a sale is paid, as the database takes it: the list of payments (0042),
 * or the one tender of a payment a till loaded before it left waiting.
 */
export function howPaid(d: {
  tender?: PayType | null;
  tenders?:
    | readonly {
        type: PayType;
        amount: string | number;
        received?: string | number | null;
        currency?: "IQD" | "USD" | null;
        usd?: number | null;
        rate?: number | null;
      }[]
    | null;
}): { p_tender: PayType | null; p_tenders: Payment[] | null } | null {
  if (d.tenders)
    return {
      p_tender: null,
      p_tenders: d.tenders.map((x) => ({
        type: x.type,
        amount: Number(x.amount),
        received:
          x.received === null || x.received === undefined || x.received === ""
            ? null
            : Number(x.received),
        // Dollars (0043): what was handed over and the rate shown; the database values them.
        ...(x.currency === "USD"
          ? { currency: "USD" as const, usd: Number(x.usd), rate: Number(x.rate) }
          : {}),
      })),
    };
  if (d.tender) return { p_tender: d.tender, p_tenders: null };
  return null;
}

/** A recorded sale, as the database reported it. */
export function saleReceipt(d: Record<string, unknown>): SaleReceipt {
  const net = Number(d.net ?? 0);
  return {
    orderId: String(d.order_id),
    gross: Number(d.gross ?? net),
    discount: Number(d.discount ?? 0),
    net,
    ...(d.cogs !== undefined ? { cogs: Number(d.cogs) } : {}),
    journalNo: d.journal_no == null ? null : Number(d.journal_no),
    replayed: Boolean(d.replayed),
    platformOrderNo: d.platform_order_no == null ? null : String(d.platform_order_no),
    turnNo: d.turn_no == null ? null : Number(d.turn_no),
    payments: Array.isArray(d.payments)
      ? (d.payments as Record<string, unknown>[]).map(paidPart)
      : [],
    customer: saleCustomerFrom(d.customer),
  };
}

/** What the database says of a refund's parts that cannot go back so, word for word (0042). */
export function refundSplitMessage(p: RefundSplitProblem, total: number): string {
  switch (p.kind) {
    case "notNumber":
      return "The payments to give back cannot be read";
    case "tooMuch":
      return p.type === "cash"
        ? `Only ${p.left} of the cash paid is left to give back`
        : p.type === "card"
          ? `Only ${p.left} of the card payment is left to give back`
          : `Only ${p.left} of the platform's payment is left to give back`;
    case "sum":
      return `The refund is ${total}, but the payments given back come to ${p.sum}`;
  }
}
