import Decimal from "decimal.js";
import { normaliseNumber } from "@/lib/validation";

/**
 * The drawer count as the form previews it, the way count_drawer (0024) posts
 * it: expected = what the drawer started with + every cash movement since;
 * the difference is counted − expected; what does not stay in the drawer goes
 * to the safe or the bank.
 */
export interface DrawerPreview {
  expected: number | null;
  variance: number | null;
  left: number | null;
  taken: number | null;
  error: string | null;
}

const amount = (v: string): Decimal | null => {
  const s = normaliseNumber(v);
  if (s === "" || !/^\d+(\.\d+)?$/.test(s)) return null;
  return new Decimal(s);
};

export function drawerPreview(p: {
  /** What the last count left in the drawer; null when it must be typed. */
  start: number | null;
  /** Typed only for the first count after days closed the old way. */
  startTyped: string;
  /** Every cash movement since the last count, signed. */
  moved: number;
  counted: string;
  /** Empty: everything counted stays in the drawer. */
  left: string;
}): DrawerPreview {
  const start = p.start !== null ? new Decimal(p.start) : amount(p.startTyped);
  const expected = start === null ? null : start.plus(p.moved);
  const counted = amount(p.counted);
  if (counted === null) {
    return {
      expected: expected?.toNumber() ?? null,
      variance: null,
      left: null,
      taken: null,
      error: null,
    };
  }
  const left = p.left.trim() === "" ? counted : amount(p.left);
  if (left === null || left.gt(counted)) {
    return {
      expected: expected?.toNumber() ?? null,
      variance: expected ? counted.minus(expected).toNumber() : null,
      left: null,
      taken: null,
      // A phrase of the sales book: the form shows it in the reader's language (msg()).
      error: "What stays in the drawer must be between 0 and the cash counted.",
    };
  }
  return {
    expected: expected?.toNumber() ?? null,
    variance: expected ? counted.minus(expected).toNumber() : null,
    left: left.toNumber(),
    taken: counted.minus(left).toNumber(),
    error: null,
  };
}
