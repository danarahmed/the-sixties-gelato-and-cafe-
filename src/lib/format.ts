/** Shared, framework-neutral display labels and formatters (no demo data). */
import type { SalesChannel } from "@domain/sales/recipe.js";

export const SELLABLE_CHANNELS: SalesChannel[] = [
  "dine_in",
  "takeaway",
  "direct_delivery",
  "talabat",
];

export const channelLabel: Record<SalesChannel, string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  direct_delivery: "Direct delivery",
  talabat: "Talabat",
  careem: "Careem",
  toters: "Toters",
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  ingredient: "Ingredient",
  packaging: "Packaging",
  consumable: "Consumable",
  finished_good: "Finished good",
  resale: "Resale",
  sub_recipe_output: "Sub-recipe",
};
export function itemTypeLabel(t: string): string {
  return ITEM_TYPE_LABEL[t] ?? t;
}

const MOVEMENT_LABEL: Record<string, string> = {
  opening_balance: "Opening balance",
  purchase_receipt: "Purchase receipt",
  sale_consumption: "Sale",
  production_consumption: "Production use",
  production_output: "Production output",
  count_adjustment: "Count adjustment",
  manual_correction: "Manual correction",
  waste: "Waste",
  spoilage: "Spoilage",
  expired: "Expired",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  refund_return_to_stock: "Refund return",
  reversal: "Reversal",
};
export function movementLabel(t: string): string {
  return MOVEMENT_LABEL[t] ?? t.replace(/_/g, " ");
}

/** Whole-IQD formatter, e.g. 12345 → "12,345 IQD". */
export function fmtIQD(n: number): string {
  return `${Math.round(n).toLocaleString()} IQD`;
}
