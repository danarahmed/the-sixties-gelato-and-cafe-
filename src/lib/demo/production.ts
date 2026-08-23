/**
 * Self-contained production demo: a pistachio gelato batch. Uses the real
 * planProductionBatch() so consumption, finished-goods valuation, and yield
 * variance are computed by the tested engine. EXAMPLE data.
 */
import Decimal from "decimal.js";
import { IQD, Money } from "@domain/money/money.js";
import { UnitSystem, type UnitDefinition } from "@domain/units/units.js";
import type { Recipe } from "@domain/sales/recipe.js";
import type { WacState } from "@domain/costing/wac.js";
import { planProductionBatch, type ProductionResult } from "@domain/inventory/production.js";

const G: UnitDefinition = { code: "g", dimension: "mass", factorToBase: "1", label: "g" };
const KG: UnitDefinition = { code: "kg", dimension: "mass", factorToBase: "1000", label: "kg" };
const ML: UnitDefinition = { code: "ml", dimension: "volume", factorToBase: "1", label: "ml" };
const L: UnitDefinition = { code: "L", dimension: "volume", factorToBase: "1000", label: "L" };

interface BatchItem {
  id: string;
  name: string;
  unitCost: number;
  units: UnitSystem;
}

export const BATCH_ITEMS: Record<string, BatchItem> = {
  milk: { id: "milk", name: "Milk", unitCost: 2, units: new UnitSystem("ml", [ML, L]) },
  cream: { id: "cream", name: "Cream", unitCost: 3, units: new UnitSystem("ml", [ML, L]) },
  sugar: { id: "sugar", name: "Sugar", unitCost: 1, units: new UnitSystem("g", [G, KG]) },
  pistachio_paste: {
    id: "pistachio_paste",
    name: "Pistachio paste",
    unitCost: 20,
    units: new UnitSystem("g", [G, KG]),
  },
  gelato_pistachio: {
    id: "gelato_pistachio",
    name: "Pistachio gelato",
    unitCost: 0,
    units: new UnitSystem("g", [G, KG]),
  },
};

export const BATCH_RECIPE: Recipe = {
  id: "pistachio_gelato_batch",
  outputItemId: "gelato_pistachio",
  batchYieldBase: 5000, // planned grams per batch
  lines: [
    { componentType: "item", componentId: "milk", quantity: 2500, unitCode: "ml" },
    { componentType: "item", componentId: "cream", quantity: 1500, unitCode: "ml" },
    { componentType: "item", componentId: "sugar", quantity: 800, unitCode: "g" },
    { componentType: "item", componentId: "pistachio_paste", quantity: 400, unitCode: "g" },
  ],
};

const ctx = {
  getRecipe: (id: string) => {
    if (id === BATCH_RECIPE.id) return BATCH_RECIPE;
    throw new Error(`Unknown recipe ${id}`);
  },
  getUnitSystem: (itemId: string) => {
    const it = BATCH_ITEMS[itemId];
    if (!it) throw new Error(`Unknown batch item ${itemId}`);
    return it.units;
  },
};

function wacMap(): Map<string, WacState> {
  const m = new Map<string, WacState>();
  for (const [id, it] of Object.entries(BATCH_ITEMS)) {
    m.set(id, {
      quantityBase: new Decimal(100000),
      totalValue: Money.of(it.unitCost * 100000, IQD),
    });
  }
  return m;
}

export function runBatch(batches: number, actualYieldBase: number): ProductionResult {
  return planProductionBatch({
    recipe: BATCH_RECIPE,
    batches,
    actualOutputBase: actualYieldBase,
    ctx,
    wacByItem: wacMap(),
    currency: IQD,
  });
}

export function batchItemName(id: string): string {
  return BATCH_ITEMS[id]?.name ?? id;
}
