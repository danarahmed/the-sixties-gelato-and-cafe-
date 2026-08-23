/**
 * Recipes, channel-aware Bill-of-Materials expansion, and per-serving cost.
 *
 * RECIPE RULE: a single recipe serves every sales channel. Each recipe line may
 * be gated to specific channels via `appliesToChannels`. A line with no gate
 * applies to every channel. This is how one "Iced Latte" recipe deducts:
 *   - dine-in:  espresso, milk, syrup, ice   (reusable glass → no disposables)
 *   - takeaway: + cup, lid, straw
 *   - talabat:  + cup, lid, straw, delivery bag, napkins, sticker, tamper seal
 *
 * Lines may reference a raw ITEM or a SUB-RECIPE (expanded recursively). All
 * quantities are converted to each item's base unit using its UnitSystem.
 */
import Decimal from "decimal.js";
import { Quantity, type UnitSystem } from "../units/units.js";
import { Money, type Currency } from "../money/money.js";
import { averageUnitCost, type WacState } from "../costing/wac.js";

/** Sales channel / order type that drives packaging selection. */
export type SalesChannel =
  "dine_in" | "takeaway" | "direct_delivery" | "talabat" | "careem" | "toters";

export type ComponentType = "item" | "sub_recipe";

export interface RecipeLine {
  componentType: ComponentType;
  /** itemId when componentType="item"; recipeId when "sub_recipe". */
  componentId: string;
  quantity: Decimal | number | string;
  unitCode: string;
  /** If present, this line only deducts when the sale channel is in the set. */
  appliesToChannels?: SalesChannel[];
  note?: string;
}

export interface Recipe {
  id: string;
  /** Finished-goods item this recipe produces (for production recipes). */
  outputItemId?: string;
  /** For production: yield of output produced by one batch, in output base units. */
  batchYieldBase?: Decimal | number | string;
  lines: RecipeLine[];
}

/** A single resolved deduction against one inventory item, in base units. */
export interface ResolvedDeduction {
  itemId: string;
  baseQuantity: Decimal;
}

export interface RecipeResolverContext {
  getRecipe: (recipeId: string) => Recipe;
  getUnitSystem: (itemId: string) => UnitSystem;
}

function lineAppliesToChannel(line: RecipeLine, channel: SalesChannel): boolean {
  if (!line.appliesToChannels || line.appliesToChannels.length === 0) return true;
  return line.appliesToChannels.includes(channel);
}

/**
 * Expand a recipe for a sale on a given channel into base-unit deductions.
 * `servings` scales every line (e.g. selling 2 identical drinks). Deductions
 * for the same item are merged.
 */
export function expandRecipeForSale(
  recipe: Recipe,
  channel: SalesChannel,
  servings: Decimal | number | string,
  ctx: RecipeResolverContext,
): ResolvedDeduction[] {
  const scale = new Decimal(servings);
  const acc = new Map<string, Decimal>();
  expandInto(acc, recipe, channel, scale, ctx, new Set());
  return [...acc.entries()].map(([itemId, baseQuantity]) => ({ itemId, baseQuantity }));
}

function expandInto(
  acc: Map<string, Decimal>,
  recipe: Recipe,
  channel: SalesChannel,
  scale: Decimal,
  ctx: RecipeResolverContext,
  visiting: Set<string>,
): void {
  if (visiting.has(recipe.id)) {
    throw new Error(`Cyclic sub-recipe reference detected at recipe "${recipe.id}"`);
  }
  visiting.add(recipe.id);
  for (const line of recipe.lines) {
    if (!lineAppliesToChannel(line, channel)) continue;
    if (line.componentType === "item") {
      const system = ctx.getUnitSystem(line.componentId);
      const baseQty = Quantity.of(line.quantity, line.unitCode).toBase(system).value.times(scale);
      acc.set(line.componentId, (acc.get(line.componentId) ?? new Decimal(0)).plus(baseQty));
    } else {
      const sub = ctx.getRecipe(line.componentId);
      // Sub-recipe quantity is interpreted as "number of sub-recipe outputs".
      const subScale = new Decimal(line.quantity).times(scale);
      expandInto(acc, sub, channel, subScale, ctx, visiting);
    }
  }
  visiting.delete(recipe.id);
}

/**
 * Theoretical cost of one serving on a channel, using each item's current
 * moving-average unit cost. Deterministic given the WAC states passed in.
 */
export function recipeServingCost(
  recipe: Recipe,
  channel: SalesChannel,
  ctx: RecipeResolverContext,
  wacByItem: Map<string, WacState>,
  currency: Currency,
): Money {
  const deductions = expandRecipeForSale(recipe, channel, 1, ctx);
  let total = Money.zero(currency);
  for (const d of deductions) {
    const state = wacByItem.get(d.itemId);
    if (!state) {
      throw new Error(`Missing cost state for item "${d.itemId}" while costing recipe`);
    }
    total = total.add(averageUnitCost(state).multiply(d.baseQuantity));
  }
  return total;
}
