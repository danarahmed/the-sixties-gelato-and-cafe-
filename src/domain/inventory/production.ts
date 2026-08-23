/**
 * Production batches: consume raw materials, output finished goods at the
 * ACTUAL recorded yield, and compute yield variance.
 *
 * PRODUCTION RULE: a batch produces a traceable finished-goods lot valued at
 * the total cost consumed. Finished-goods unit cost = total consumed value /
 * actual output quantity, so the output is valued at what it actually cost to
 * make — not at a planned figure.
 */
import Decimal from "decimal.js";
import { Money, type Currency } from "../money/money.js";
import { averageUnitCost, type WacState } from "../costing/wac.js";
import { expandRecipeForSale, type Recipe, type RecipeResolverContext } from "../sales/recipe.js";

export interface ProductionConsumption {
  itemId: string;
  baseQuantity: Decimal;
  /** Value removed from inventory for this consumption. */
  value: Money;
}

export interface ProductionResult {
  consumptions: ProductionConsumption[];
  totalConsumedValue: Money;
  /** Actual output quantity in the output item's base unit. */
  actualOutputBase: Decimal;
  /** Unit cost of the finished good (total consumed / actual output). */
  outputUnitCost: Money;
  /** Value of the finished-goods lot created. */
  outputValue: Money;
  /** planned - actual, in output base units (positive = short yield). */
  yieldVarianceBase: Decimal;
}

/**
 * Plan the movements for a production batch. Consumption uses the "dine_in"
 * channel (no packaging) because a production recipe has no channel packaging.
 */
export function planProductionBatch(params: {
  recipe: Recipe;
  batches: Decimal | number | string;
  actualOutputBase: Decimal | number | string;
  ctx: RecipeResolverContext;
  wacByItem: Map<string, WacState>;
  currency: Currency;
}): ProductionResult {
  const { recipe, ctx, wacByItem, currency } = params;
  const batches = new Decimal(params.batches);
  const actualOutputBase = new Decimal(params.actualOutputBase);

  if (!recipe.outputItemId) {
    throw new Error(`Recipe "${recipe.id}" has no outputItemId; not a production recipe`);
  }
  if (recipe.batchYieldBase === undefined) {
    throw new Error(`Recipe "${recipe.id}" has no batchYieldBase; cannot plan production`);
  }

  const deductions = expandRecipeForSale(recipe, "dine_in", batches, ctx);
  const consumptions: ProductionConsumption[] = [];
  let totalConsumedValue = Money.zero(currency);

  for (const d of deductions) {
    const state = wacByItem.get(d.itemId);
    if (!state) throw new Error(`Missing cost state for consumed item "${d.itemId}"`);
    const value = averageUnitCost(state).multiply(d.baseQuantity);
    consumptions.push({ itemId: d.itemId, baseQuantity: d.baseQuantity, value });
    totalConsumedValue = totalConsumedValue.add(value);
  }

  const plannedOutputBase = new Decimal(recipe.batchYieldBase).times(batches);
  const outputUnitCost = actualOutputBase.greaterThan(0)
    ? totalConsumedValue.divide(actualOutputBase)
    : Money.zero(currency);

  return {
    consumptions,
    totalConsumedValue: totalConsumedValue.quantize(),
    actualOutputBase,
    outputUnitCost,
    // Output is valued at exactly the consumed value (no cost created or lost).
    outputValue: totalConsumedValue.quantize(),
    yieldVarianceBase: plannedOutputBase.minus(actualOutputBase),
  };
}
