/**
 * Moving weighted-average cost (WAC) — the default costing method.
 *
 * COSTING RULE: the average unit cost changes only on RECEIPTS (purchases,
 * production output, positive adjustments with a cost). Issues (sales,
 * production consumption, waste) are valued at the average cost in force at
 * the moment they occur, and they do NOT change the average. This makes cost
 * of goods sold deterministic and reproducible from the ledger.
 *
 * Landed cost (freight, rebates, discounts, duties) is folded into the receipt
 * value BEFORE it reaches this engine — see `landedUnitCost`.
 */
import Decimal from "decimal.js";
import { Money, type Currency } from "../money/money.js";

export interface WacState {
  /** Quantity on hand, in the item's base unit. */
  readonly quantityBase: Decimal;
  /** Total inventory value of that quantity. */
  readonly totalValue: Money;
}

export interface WacReceipt {
  /** Quantity received, in base units. */
  quantityBase: Decimal | number | string;
  /** Total value of this receipt (already landed). */
  value: Money;
}

export interface WacIssueResult {
  state: WacState;
  /** Value removed from inventory for this issue (the COGS for a sale). */
  issuedValue: Money;
  /** The unit cost applied to this issue (a historical snapshot). */
  unitCostSnapshot: Money;
}

export function emptyWacState(currency: Currency): WacState {
  return { quantityBase: new Decimal(0), totalValue: Money.zero(currency) };
}

/** Compute the total landed value of a purchase line and its per-base-unit cost. */
export function landedUnitCost(params: {
  /** Quantity received expressed in BASE units. */
  quantityBase: Decimal | number | string;
  /** Sum of the line goods value. */
  goodsValue: Money;
  /** Allocated freight/handling for this line (>= 0). */
  allocatedFreight?: Money;
  /** Allocated other landed costs (duties, etc.) for this line (>= 0). */
  allocatedOther?: Money;
  /** Rebate/discount attributable to this line (>= 0, reduces cost). */
  allocatedRebate?: Money;
}): { landedValue: Money; unitCost: Money } {
  const currency = params.goodsValue.currency;
  const qty = new Decimal(params.quantityBase);
  if (qty.lessThanOrEqualTo(0)) {
    throw new Error("landedUnitCost requires a positive quantity");
  }
  const landedValue = params.goodsValue
    .add(params.allocatedFreight ?? Money.zero(currency))
    .add(params.allocatedOther ?? Money.zero(currency))
    .subtract(params.allocatedRebate ?? Money.zero(currency));
  return { landedValue, unitCost: landedValue.divide(qty) };
}

/** Apply a receipt: increases quantity and value; recomputes the average. */
export function applyReceipt(state: WacState, receipt: WacReceipt): WacState {
  const qty = new Decimal(receipt.quantityBase);
  if (qty.lessThanOrEqualTo(0)) {
    throw new Error("A receipt must have a positive quantity");
  }
  return {
    quantityBase: state.quantityBase.plus(qty),
    totalValue: state.totalValue.add(receipt.value),
  };
}

/** The current moving-average unit cost, or zero when there is no stock. */
export function averageUnitCost(state: WacState): Money {
  if (state.quantityBase.lessThanOrEqualTo(0)) {
    return Money.zero(state.totalValue.currency);
  }
  return state.totalValue.divide(state.quantityBase);
}

/**
 * Apply an issue (sale/consumption/waste): reduces quantity and value at the
 * current average cost. Returns the value removed (COGS) and the unit-cost
 * snapshot to persist against the source transaction for historical accuracy.
 */
export function applyIssue(
  state: WacState,
  quantityBase: Decimal | number | string,
): WacIssueResult {
  const qty = new Decimal(quantityBase);
  if (qty.lessThanOrEqualTo(0)) {
    throw new Error("An issue must have a positive quantity");
  }
  const unitCost = averageUnitCost(state);
  const issuedValue = unitCost.multiply(qty);
  const remainingQty = state.quantityBase.minus(qty);
  // Guard against tiny residual value when the last unit leaves stock.
  const remainingValue = remainingQty.isZero()
    ? Money.zero(state.totalValue.currency)
    : state.totalValue.subtract(issuedValue);
  return {
    state: { quantityBase: remainingQty, totalValue: remainingValue },
    issuedValue,
    unitCostSnapshot: unitCost,
  };
}
