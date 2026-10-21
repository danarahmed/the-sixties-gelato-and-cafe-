/**
 * Refunds by the item (0037): what each line gives back, worked out as the
 * database works it out, so the Orders screen shows the amounts before
 * anything is refunded. A line gives back its share of its net (what it was
 * sold for after the bill's discount), in whole dinars, half to even; the last
 * refund of a line takes exactly what is left of it, so a sale's refunds add
 * up to the sale.
 */
import { normaliseNumber } from "@/lib/validation";

export interface RefundableLine {
  id: string;
  name: string;
  /** How many were sold, and for how much after the bill's discount. */
  qty: number;
  lineNet: number;
  /** Given back by earlier refunds of this line. */
  refundedQty: number;
  refundedAmount: number;
}

/** A number of dinars rounded to whole dinars, half to even (money_round for the IQD). */
export function roundMoney(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return d < 0.5 ? f : f + 1;
}

/** `want` of the line's `qty`, as a share of its net: exact when all three are whole. */
export function shareOf(lineNet: number, want: number, qty: number): number {
  if ([lineNet, want, qty].every(Number.isInteger) && qty > 0) {
    const n = lineNet * want;
    const q = Math.floor(n / qty);
    const r = n - q * qty;
    if (2 * r < qty) return q;
    if (2 * r > qty) return q + 1;
    return q % 2 === 0 ? q : q + 1;
  }
  return roundMoney((lineNet * want) / qty);
}

/** What is left of a line to give back. */
export function leftOf(line: RefundableLine): { qty: number; amount: number } {
  return { qty: line.qty - line.refundedQty, amount: line.lineNet - line.refundedAmount };
}

/** What `want` of the line gives back: its share of the net, or, for the last of it, all that is left. */
export function refundLineAmount(line: RefundableLine, want: number): number {
  const left = leftOf(line);
  if (!(want > 0)) return 0;
  if (want === left.qty) return left.amount;
  return Math.min(left.amount, shareOf(line.lineNet, want, line.qty));
}

export type RefundProblem =
  | { kind: "notNumber"; name: string }
  | { kind: "tooMany"; name: string; left: number }
  | { kind: "nothing" };

export interface RefundPlan {
  /** The lines as the database takes them, each with what it gives back. */
  lines: { lineId: string; qty: number; amount: number }[];
  total: number;
  /** The first thing wrong with what was typed; null when it can go. */
  problem: RefundProblem | null;
}

/**
 * The refund the screen would send, from how many of each line were typed
 * (blank: none), checked as the database checks it.
 */
export function refundPlan(lines: RefundableLine[], wants: Record<string, string>): RefundPlan {
  const out: RefundPlan["lines"] = [];
  let problem: RefundProblem | null = null;
  for (const line of lines) {
    const raw = normaliseNumber(wants[line.id] ?? "");
    if (raw === "") continue;
    if (!/^\d+(\.\d+)?$/.test(raw)) {
      problem ??= { kind: "notNumber", name: line.name };
      continue;
    }
    const want = Number(raw);
    if (want === 0) continue;
    const left = leftOf(line).qty;
    if (want > left) {
      problem ??= { kind: "tooMany", name: line.name, left };
      continue;
    }
    out.push({ lineId: line.id, qty: want, amount: refundLineAmount(line, want) });
  }
  const total = out.reduce((s, l) => s + l.amount, 0);
  if (!problem && out.length === 0) problem = { kind: "nothing" };
  return { lines: out, total, problem };
}

/** All that is left of each line: the refund the screen starts from. */
export function allThatIsLeft(lines: RefundableLine[]): Record<string, string> {
  return Object.fromEntries(
    lines.map((l) => [l.id, leftOf(l).qty > 0 ? String(leftOf(l).qty) : ""]),
  );
}

/** A sale's service charge (0090), and what refunds gave back of it so far. */
export interface RefundService {
  amount: number;
  back: number;
  /** What the products came to after discounts: the service charge was a share of it. */
  net: number;
}

/**
 * The service charge a refund gives back with what it refunds (0090), as the
 * database works it out: all that is left of it when nothing of the sale is
 * left after this refund; otherwise its share of what is refunded, in whole
 * dinars, half to even, never more than is left of it.
 */
export function serviceBack(
  lines: RefundableLine[],
  wants: Record<string, string>,
  service: RefundService | null | undefined,
  refunded: number,
): number {
  if (!service || service.amount <= 0 || service.net <= 0 || refunded <= 0) return 0;
  const left = Math.max(service.amount - service.back, 0);
  const rest = lines.some((l) => {
    const raw = normaliseNumber(wants[l.id] ?? "");
    const want = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : 0;
    return leftOf(l).qty - want > 0;
  });
  if (!rest) return left;
  return Math.max(Math.min(left, shareOf(refunded, service.amount, service.net)), 0);
}
