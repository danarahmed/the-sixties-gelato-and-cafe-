/**
 * Receiving at a price per unit (0027, the audit's P1-3), shared by the form
 * and its tests.
 */

/** How the database begins its answer when a price is far from the item's cost now. */
export const CHECK_THE_PRICE = "Check the price:";

/** Whether a refused delivery only needs the person to confirm its prices. */
export function needsPriceConfirmation(error: string): boolean {
  return error.startsWith(CHECK_THE_PRICE);
}

/**
 * A line's total and its cost per base unit, from its quantity, the unit's
 * size in base units and the price of one unit. Null where it cannot be told.
 */
export function deliveryLineCost(
  qty: number,
  factor: number,
  unitPrice: number,
): { total: number; perBase: number | null } {
  const total = qty * unitPrice;
  const base = qty * factor;
  return { total, perBase: base > 0 ? total / base : null };
}

/** How far a cost is from the cost now, as a signed fraction (0.25 is 25% above). */
export function priceGap(perBase: number | null, costNow: number | null): number | null {
  if (perBase === null || costNow === null || costNow <= 0) return null;
  return (perBase - costNow) / costNow;
}
