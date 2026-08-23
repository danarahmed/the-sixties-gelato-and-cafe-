/**
 * Self-contained demo catalog that drives the POS screen using the REAL domain
 * core (unit conversion, channel-aware recipe expansion, WAC costing). It needs
 * no database, so the demo runs offline and proves the calculations end-to-end.
 * All prices/costs are illustrative examples.
 */
import Decimal from "decimal.js";
import { UnitSystem, type UnitDefinition } from "@domain/units/units.js";
import type { Recipe, SalesChannel } from "@domain/sales/recipe.js";
import { IQD, Money } from "@domain/money/money.js";
import type { WacState } from "@domain/costing/wac.js";

const EACH: UnitDefinition = { code: "each", dimension: "count", factorToBase: "1", label: "Each" };
const G: UnitDefinition = { code: "g", dimension: "mass", factorToBase: "1", label: "g" };
const ML: UnitDefinition = { code: "ml", dimension: "volume", factorToBase: "1", label: "ml" };

function sys(base: UnitDefinition): UnitSystem {
  return new UnitSystem(base.code, [base]);
}

export interface DemoItem {
  id: string;
  name: string;
  unitCostIQD: number; // per base unit
  base: UnitDefinition;
}

/** itemId → demo item (name, cost, unit). */
export const DEMO_ITEMS: Record<string, DemoItem> = {
  coffee_beans: { id: "coffee_beans", name: "Coffee beans", unitCostIQD: 40, base: G },
  milk: { id: "milk", name: "Milk", unitCostIQD: 2, base: ML },
  vanilla_syrup: { id: "vanilla_syrup", name: "Vanilla syrup", unitCostIQD: 5, base: ML },
  ice: { id: "ice", name: "Ice", unitCostIQD: 0.2, base: G },
  gelato_pistachio: { id: "gelato_pistachio", name: "Pistachio gelato", unitCostIQD: 3.8125, base: G },
  cup_takeaway: { id: "cup_takeaway", name: "Takeaway cup", unitCostIQD: 100, base: EACH },
  lid: { id: "lid", name: "Cup lid", unitCostIQD: 50, base: EACH },
  straw: { id: "straw", name: "Straw", unitCostIQD: 20, base: EACH },
  gelato_cup: { id: "gelato_cup", name: "Gelato cup", unitCostIQD: 120, base: EACH },
  gelato_spoon: { id: "gelato_spoon", name: "Gelato spoon", unitCostIQD: 15, base: EACH },
  napkin: { id: "napkin", name: "Napkin", unitCostIQD: 10, base: EACH },
  delivery_bag: { id: "delivery_bag", name: "Delivery bag", unitCostIQD: 150, base: EACH },
  sticker: { id: "sticker", name: "Sticker", unitCostIQD: 30, base: EACH },
  tamper_seal: { id: "tamper_seal", name: "Tamper seal", unitCostIQD: 40, base: EACH },
  carrier: { id: "carrier", name: "Drink carrier", unitCostIQD: 200, base: EACH },
};

export function getUnitSystem(itemId: string): UnitSystem {
  const item = DEMO_ITEMS[itemId];
  if (!item) throw new Error(`Unknown demo item ${itemId}`);
  return sys(item.base);
}

export function wacFor(itemId: string): WacState {
  const item = DEMO_ITEMS[itemId];
  if (!item) throw new Error(`Unknown demo item ${itemId}`);
  // A state whose average unit cost equals the demo cost exactly.
  return { quantityBase: new Decimal(1000), totalValue: Money.of(item.unitCostIQD * 1000, IQD) };
}

export const wacByItem = new Map(Object.keys(DEMO_ITEMS).map((id) => [id, wacFor(id)]));

const DISPOSABLE: SalesChannel[] = ["takeaway", "direct_delivery", "talabat"];
const DELIVERY: SalesChannel[] = ["direct_delivery", "talabat"];
const PLATFORM: SalesChannel[] = ["talabat"];

export const DEMO_RECIPES: Record<string, Recipe> = {
  iced_latte: {
    id: "iced_latte",
    lines: [
      { componentType: "item", componentId: "coffee_beans", quantity: 18, unitCode: "g" },
      { componentType: "item", componentId: "milk", quantity: 200, unitCode: "ml" },
      { componentType: "item", componentId: "vanilla_syrup", quantity: 30, unitCode: "ml" },
      { componentType: "item", componentId: "ice", quantity: 150, unitCode: "g" },
      { componentType: "item", componentId: "cup_takeaway", quantity: 1, unitCode: "each", appliesToChannels: DISPOSABLE },
      { componentType: "item", componentId: "lid", quantity: 1, unitCode: "each", appliesToChannels: DISPOSABLE },
      { componentType: "item", componentId: "straw", quantity: 1, unitCode: "each", appliesToChannels: DISPOSABLE },
      { componentType: "item", componentId: "delivery_bag", quantity: 1, unitCode: "each", appliesToChannels: DELIVERY },
      { componentType: "item", componentId: "napkin", quantity: 2, unitCode: "each", appliesToChannels: DELIVERY },
      { componentType: "item", componentId: "sticker", quantity: 1, unitCode: "each", appliesToChannels: PLATFORM },
      { componentType: "item", componentId: "tamper_seal", quantity: 1, unitCode: "each", appliesToChannels: PLATFORM },
      { componentType: "item", componentId: "carrier", quantity: 1, unitCode: "each", appliesToChannels: PLATFORM },
    ],
  },
  gelato_cup_pistachio: {
    id: "gelato_cup_pistachio",
    lines: [
      { componentType: "item", componentId: "gelato_pistachio", quantity: 90, unitCode: "g" },
      { componentType: "item", componentId: "gelato_cup", quantity: 1, unitCode: "each" },
      { componentType: "item", componentId: "gelato_spoon", quantity: 1, unitCode: "each" },
      { componentType: "item", componentId: "napkin", quantity: 1, unitCode: "each" },
      { componentType: "item", componentId: "delivery_bag", quantity: 1, unitCode: "each", appliesToChannels: DELIVERY },
    ],
  },
};

export interface DemoProduct {
  id: string;
  name: string;
  recipeId: string;
  /** Price per channel (IQD). */
  price: Partial<Record<SalesChannel, number>>;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: "iced_latte",
    name: "Iced Latte (Medium)",
    recipeId: "iced_latte",
    price: { dine_in: 4000, takeaway: 4000, direct_delivery: 4000, talabat: 5000 },
  },
  {
    id: "gelato_cup_pistachio",
    name: "Gelato Cup — Pistachio",
    recipeId: "gelato_cup_pistachio",
    price: { dine_in: 3500, takeaway: 3500, direct_delivery: 3500, talabat: 4500 },
  },
];

export const resolverContext = {
  getRecipe: (id: string) => {
    const r = DEMO_RECIPES[id];
    if (!r) throw new Error(`Unknown recipe ${id}`);
    return r;
  },
  getUnitSystem,
};

export function itemName(itemId: string): string {
  return DEMO_ITEMS[itemId]?.name ?? itemId;
}
