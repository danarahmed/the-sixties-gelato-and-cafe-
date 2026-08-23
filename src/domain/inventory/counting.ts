/**
 * Physical stock counting and variance.
 *
 * COUNTING RULE: a count never overwrites stock. It records what was counted;
 * after approval the system posts a single `count_adjustment` movement equal to
 * (counted - expected) in base units, so the ledger self-heals while preserving
 * the full history. A blind count hides the expected quantity from the counter.
 */
import Decimal from "decimal.js";
import { Money, type Currency } from "../money/money.js";
import { averageUnitCost, type WacState } from "../costing/wac.js";

export interface CountLine {
  itemId: string;
  locationId: string;
  /** System-expected quantity in base units (hidden from a blind counter). */
  expectedBase: Decimal;
  /** Counted quantity in base units. */
  countedBase: Decimal;
}

export interface CountVariance {
  itemId: string;
  locationId: string;
  expectedBase: Decimal;
  countedBase: Decimal;
  /** counted - expected. Negative = shrinkage. */
  quantityVarianceBase: Decimal;
  /** Value impact at current moving-average cost. */
  valueVariance: Money;
}

export function computeCountVariance(
  line: CountLine,
  wac: WacState,
  currency: Currency,
): CountVariance {
  const quantityVarianceBase = line.countedBase.minus(line.expectedBase);
  const valueVariance = averageUnitCost(wac).multiply(quantityVarianceBase);
  return {
    itemId: line.itemId,
    locationId: line.locationId,
    expectedBase: line.expectedBase,
    countedBase: line.countedBase,
    quantityVarianceBase,
    valueVariance: valueVariance.quantize(),
  };
}

/**
 * The signed base quantity to post as a `count_adjustment` movement after
 * approval. Returns null when there is no variance (nothing to post).
 */
export function adjustmentQuantityForCount(variance: CountVariance): Decimal | null {
  if (variance.quantityVarianceBase.isZero()) return null;
  return variance.quantityVarianceBase;
}

/** Whether a variance exceeds an approval threshold and needs sign-off. */
export function requiresApproval(
  variance: CountVariance,
  thresholds: { quantityBase?: Decimal; value?: Money },
): boolean {
  if (
    thresholds.quantityBase &&
    variance.quantityVarianceBase.abs().greaterThan(thresholds.quantityBase)
  ) {
    return true;
  }
  if (thresholds.value && variance.valueVariance.abs().greaterThan(thresholds.value)) {
    return true;
  }
  return false;
}
