/**
 * The bank reconciled against its statement (0059). What a statement being
 * kept comes to: the last statement's balance, and the lines ticked, against
 * the balance the bank gives. Pure, so the screen and the unit tests agree
 * with the database, which checks it all again when the statement is kept.
 */
import Decimal from "decimal.js";
import { normaliseNumber } from "@/lib/validation";

/** A balance as the bank may give it: overdrawn is below zero. */
const SIGNED = /^-?\d+(\.\d+)?$/;

export interface BankMath {
  /** What the lines ticked brought in, and took out. */
  moneyIn: Decimal;
  moneyOut: Decimal;
  /** Where they take the bank: the last statement's balance, plus in, less out. */
  reached: Decimal;
  /** The balance the bank gives, as typed; null until it is a number. */
  closing: Decimal | null;
  /** The bank's balance less where the lines take it: zero when it ties. */
  difference: Decimal | null;
}

export function bankMath(
  opening: Decimal.Value,
  ticked: readonly Decimal.Value[],
  closingText: string,
): BankMath {
  let moneyIn = new Decimal(0);
  let moneyOut = new Decimal(0);
  for (const a of ticked) {
    const d = new Decimal(a);
    if (d.isNegative()) moneyOut = moneyOut.plus(d.negated());
    else moneyIn = moneyIn.plus(d);
  }
  const reached = new Decimal(opening).plus(moneyIn).minus(moneyOut);
  const typed = normaliseNumber(closingText);
  const closing = SIGNED.test(typed) ? new Decimal(typed) : null;
  return {
    moneyIn,
    moneyOut,
    reached,
    closing,
    difference: closing ? closing.minus(reached) : null,
  };
}

/** The lines a statement ending on a day may take: those on or before it. */
export function linesTo<T extends { day: string }>(lines: readonly T[], day: string): T[] {
  return day ? lines.filter((l) => l.day <= day) : [];
}
