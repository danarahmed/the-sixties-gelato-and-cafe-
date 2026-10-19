/**
 * Selling by weight (round seventeen, 0075): what the till takes as a weight,
 * and how it shows one. A size sold by weight is priced by the kilo, and its
 * line's quantity is the weight in kilos, to the gram, as the database keeps it.
 */
import Decimal from "decimal.js";

export const MIN_KG = new Decimal("0.001");
export const MAX_KG = new Decimal(1000);

/** A weight typed in grams or kilos, as kilos to the gram; null when it is none, or out of range. */
export function parseWeight(text: string, unit: "g" | "kg"): Decimal | null {
  const s = text
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[,،٫]/g, ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const kg = (unit === "g" ? new Decimal(s).div(1000) : new Decimal(s)).toDecimalPlaces(
    3,
    Decimal.ROUND_HALF_UP,
  );
  return kg.lt(MIN_KG) || kg.gt(MAX_KG) ? null : kg;
}

/**
 * "750 g" under a kilo, "1.25 kg" from one: how the till, the receipt and the
 * ticket say it, with the units in the reader's language.
 */
export function fmtWeight(
  kg: number,
  units: { g: string; kg: string } = { g: "g", kg: "kg" },
): string {
  const d = new Decimal(kg);
  return d.lt(1)
    ? `${d.times(1000).toDecimalPlaces(0).toString()} ${units.g}`
    : `${d.toDecimalPlaces(3).toString()} ${units.kg}`;
}
