/**
 * A batch's figures as the form shows them before it is recorded, worked out
 * the way record_production does: each ingredient's quantity for the batches
 * made, lines of one item added together, times what the item costs today,
 * rounded to the currency unit once per item; what came out, in any of the
 * made item's units.
 */
import Decimal from "decimal.js";
import { parseNumber, roundMoney } from "@/components/pos/model";
import { fmtIQD, fmtQty } from "@/lib/format";

export interface UnitsOf {
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}

/** How many base units one of `code` is; null for a unit the item does not have. */
export function unitFactor(item: UnitsOf | undefined, code: string): number | null {
  if (!item) return null;
  if (code === item.baseUnit) return 1;
  return item.units.find((u) => u.code === code)?.factor ?? null;
}

/** The label a unit is shown with. */
export function unitLabel(item: UnitsOf | undefined, code: string): string {
  return item?.units.find((u) => u.code === code)?.label ?? code;
}

/** A base quantity, in another of the item's units, to show. */
export function showIn(base: Decimal, item: UnitsOf | undefined, code: string): string {
  const f = unitFactor(item, code) ?? 1;
  return `${fmtQty(base.div(f).toDecimalPlaces(3).toNumber())} ${unitLabel(item, code)}`;
}

/** The number of batches typed, or null while it is not a number above zero. */
export function batchesOf(typed: string): Decimal | null {
  const b = parseNumber(typed);
  return b && b.gt(0) ? b : null;
}

/**
 * What the ingredients of `batches` batches cost: each item's quantity added
 * up, times its cost today, rounded once per item, as the database posts it.
 */
export function batchCost(
  lines: { itemId: string; baseQty: number }[],
  batches: Decimal,
  unitCost: (itemId: string) => string,
  decimals: number,
): Decimal {
  const Exact = Decimal.clone({ precision: 64 });
  const qty = new Map<string, Decimal>();
  for (const l of lines) {
    const q = new Exact(l.baseQty).times(batches);
    qty.set(l.itemId, (qty.get(l.itemId) ?? new Exact(0)).plus(q));
  }
  let total = new Exact(0);
  for (const [id, q] of qty) total = total.plus(roundMoney(q.times(unitCost(id)), decimals));
  return total;
}

/** A cost per unit of what was made: whole dinars, or to the fils for a gram or a millilitre. */
export function perUnit(total: Decimal, amount: Decimal, label: string): string | null {
  if (amount.lte(0)) return null;
  const each = total.div(amount);
  return each.gte(100)
    ? `${fmtIQD(each.toNumber())} per ${label}`
    : `${fmtQty(each.toDecimalPlaces(2).toNumber())} IQD per ${label}`;
}
