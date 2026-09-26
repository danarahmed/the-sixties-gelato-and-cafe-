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

/**
 * The code of a pack an item is bought in, made from what it is called when
 * the item is added (release H): "Carton of 24" is carton_of_24. A name in
 * Arabic or Kurdish letters makes no code, so it is pack_ and its size.
 */
export function packCode(label: string, holds: number): string {
  const code = label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
    .replace(/_+$/, "");
  return code || `pack_${String(holds).replace(/[^0-9]+/g, "_")}`;
}
