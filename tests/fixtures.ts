/**
 * Minimal demo catalog used by the acceptance tests. Mirrors the seed data in
 * spirit but is self-contained so the domain tests need no database.
 */
import Decimal from "decimal.js";
import { UnitSystem, type UnitDefinition } from "../src/domain/units/units.js";
import type { Recipe, SalesChannel } from "../src/domain/sales/recipe.js";

const EACH: UnitDefinition = { code: "each", dimension: "count", factorToBase: "1", label: "Each" };
const CARTON_1000: UnitDefinition = {
  code: "carton_1000",
  dimension: "count",
  factorToBase: "1000",
  label: "Carton (1,000)",
};
const G: UnitDefinition = { code: "g", dimension: "mass", factorToBase: "1", label: "Gram" };
const KG: UnitDefinition = {
  code: "kg",
  dimension: "mass",
  factorToBase: "1000",
  label: "Kilogram",
};
const ML: UnitDefinition = {
  code: "ml",
  dimension: "volume",
  factorToBase: "1",
  label: "Millilitre",
};
const L: UnitDefinition = { code: "L", dimension: "volume", factorToBase: "1000", label: "Litre" };
const BOTTLE_700: UnitDefinition = {
  code: "bottle_700",
  dimension: "volume",
  factorToBase: "700",
  label: "Bottle (700 ml)",
};
const CASE_12X1L: UnitDefinition = {
  code: "case_12x1L",
  dimension: "volume",
  factorToBase: "12000",
  label: "Case (12 × 1 L)",
};

/** itemId → its unit system. */
export const UNIT_SYSTEMS: Record<string, UnitSystem> = {
  // Count items
  straw: new UnitSystem("each", [EACH, CARTON_1000]),
  cup_takeaway: new UnitSystem("each", [EACH, { ...CARTON_1000, label: "Sleeve (1,000)" }]),
  lid: new UnitSystem("each", [EACH]),
  delivery_bag: new UnitSystem("each", [EACH]),
  napkin: new UnitSystem("each", [EACH]),
  sticker: new UnitSystem("each", [EACH]),
  tamper_seal: new UnitSystem("each", [EACH]),
  carrier: new UnitSystem("each", [EACH]),
  gelato_cup: new UnitSystem("each", [EACH]),
  gelato_spoon: new UnitSystem("each", [EACH]),
  gelato_napkin: new UnitSystem("each", [EACH]),
  cone: new UnitSystem("each", [EACH]),
  cone_sleeve: new UnitSystem("each", [EACH]),
  // Mass items
  coffee_beans: new UnitSystem("g", [G, KG]),
  sugar: new UnitSystem("g", [G, KG]),
  pistachio_paste: new UnitSystem("g", [G, KG]),
  ice: new UnitSystem("g", [G, KG]),
  gelato_pistachio: new UnitSystem("g", [G, KG]), // finished good, sold by gram
  // Volume items
  milk: new UnitSystem("ml", [ML, L, BOTTLE_700, CASE_12X1L]),
  cream: new UnitSystem("ml", [ML, L]),
  vanilla_syrup: new UnitSystem("ml", [ML, BOTTLE_700]),
};

/** Channels that receive a disposable cup/lid/straw. */
const DISPOSABLE: SalesChannel[] = ["takeaway", "direct_delivery", "talabat", "careem", "toters"];
/** Channels that receive extra delivery packaging (bag, napkins, sticker, seal, carrier). */
const DELIVERY_PACKAGING: SalesChannel[] = ["direct_delivery", "talabat", "careem", "toters"];
/** Channels handled by a delivery platform specifically. */
const PLATFORM: SalesChannel[] = ["talabat", "careem", "toters"];

export const RECIPES: Record<string, Recipe> = {
  iced_latte: {
    id: "iced_latte",
    lines: [
      { componentType: "item", componentId: "coffee_beans", quantity: 18, unitCode: "g" },
      { componentType: "item", componentId: "milk", quantity: 200, unitCode: "ml" },
      { componentType: "item", componentId: "vanilla_syrup", quantity: 30, unitCode: "ml" },
      { componentType: "item", componentId: "ice", quantity: 150, unitCode: "g" },
      {
        componentType: "item",
        componentId: "cup_takeaway",
        quantity: 1,
        unitCode: "each",
        appliesToChannels: DISPOSABLE,
      },
      {
        componentType: "item",
        componentId: "lid",
        quantity: 1,
        unitCode: "each",
        appliesToChannels: DISPOSABLE,
      },
      {
        componentType: "item",
        componentId: "straw",
        quantity: 1,
        unitCode: "each",
        appliesToChannels: DISPOSABLE,
      },
      {
        componentType: "item",
        componentId: "delivery_bag",
        quantity: 1,
        unitCode: "each",
        appliesToChannels: DELIVERY_PACKAGING,
      },
      {
        componentType: "item",
        componentId: "napkin",
        quantity: 2,
        unitCode: "each",
        appliesToChannels: DELIVERY_PACKAGING,
      },
      {
        componentType: "item",
        componentId: "sticker",
        quantity: 1,
        unitCode: "each",
        appliesToChannels: PLATFORM,
      },
      {
        componentType: "item",
        componentId: "tamper_seal",
        quantity: 1,
        unitCode: "each",
        appliesToChannels: PLATFORM,
      },
      {
        componentType: "item",
        componentId: "carrier",
        quantity: 1,
        unitCode: "each",
        appliesToChannels: PLATFORM,
      },
    ],
  },
  gelato_cup_single: {
    id: "gelato_cup_single",
    lines: [
      { componentType: "item", componentId: "gelato_pistachio", quantity: 90, unitCode: "g" },
      { componentType: "item", componentId: "gelato_cup", quantity: 1, unitCode: "each" },
      { componentType: "item", componentId: "gelato_spoon", quantity: 1, unitCode: "each" },
      { componentType: "item", componentId: "gelato_napkin", quantity: 1, unitCode: "each" },
      {
        componentType: "item",
        componentId: "delivery_bag",
        quantity: 1,
        unitCode: "each",
        appliesToChannels: DELIVERY_PACKAGING,
      },
    ],
  },
  gelato_pistachio_batch: {
    id: "gelato_pistachio_batch",
    outputItemId: "gelato_pistachio",
    batchYieldBase: 5000, // grams of finished gelato planned per batch
    lines: [
      { componentType: "item", componentId: "milk", quantity: 2500, unitCode: "ml" },
      { componentType: "item", componentId: "cream", quantity: 1500, unitCode: "ml" },
      { componentType: "item", componentId: "sugar", quantity: 800, unitCode: "g" },
      { componentType: "item", componentId: "pistachio_paste", quantity: 400, unitCode: "g" },
    ],
  },
};

export function getUnitSystem(itemId: string): UnitSystem {
  const s = UNIT_SYSTEMS[itemId];
  if (!s) throw new Error(`No unit system fixture for "${itemId}"`);
  return s;
}

export function getRecipe(recipeId: string): Recipe {
  const r = RECIPES[recipeId];
  if (!r) throw new Error(`No recipe fixture for "${recipeId}"`);
  return r;
}

export const resolverContext = { getRecipe, getUnitSystem };

/** Helper to read a resolved deduction by item id as a Decimal. */
export function deductionMap(
  deductions: { itemId: string; baseQuantity: Decimal }[],
): Map<string, Decimal> {
  const m = new Map<string, Decimal>();
  for (const d of deductions) m.set(d.itemId, d.baseQuantity);
  return m;
}
