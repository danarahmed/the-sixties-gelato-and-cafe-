/** Shared, framework-neutral display labels and formatters (no demo data). */
import type { SalesChannel } from "@domain/sales/recipe.js";

export const SELLABLE_CHANNELS: SalesChannel[] = [
  "dine_in",
  "takeaway",
  "direct_delivery",
  "talabat",
];

/** Delivery platforms settle the money themselves: their orders are platform-paid. */
export const PLATFORM_CHANNELS: SalesChannel[] = ["talabat", "careem", "toters"];

export const channelLabel: Record<SalesChannel, string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  direct_delivery: "Direct delivery",
  talabat: "Talabat",
  careem: "Careem",
  toters: "Toters",
};

const TENDER_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  platform_paid: "Platform-paid",
  bank: "Bank",
  transfer: "Bank transfer",
};
export function tenderLabel(t: string): string {
  return TENDER_LABEL[t] ?? t;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  general_manager: "General manager",
  branch_manager: "Branch manager",
  cashier: "Cashier",
  barista: "Barista / production",
  inventory_counter: "Inventory counter",
  purchasing: "Purchasing",
  accountant: "Accountant",
  auditor: "Read-only auditor",
};
export function roleLabel(r: string): string {
  return ROLE_LABEL[r] ?? r;
}

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
  supplier_return: "Supplier return",
  sale_consumption: "Sale",
  production_consumption: "Production use",
  production_output: "Production output",
  count_adjustment: "Count adjustment",
  manual_correction: "Manual correction",
  waste: "Waste",
  spoilage: "Spoilage",
  expired: "Expired",
  damaged: "Damaged",
  melt_evaporation: "Melt / evaporation",
  staff_consumption: "Staff consumption",
  complimentary: "Complimentary",
  sampling: "Sampling",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  refund_return_to_stock: "Refund return",
  reversal: "Reversal",
};
export function movementLabel(t: string): string {
  return MOVEMENT_LABEL[t] ?? t.replace(/_/g, " ");
}

/** Waste types a person may record (the database accepts exactly these). */
export const WASTE_TYPES = [
  "waste",
  "spoilage",
  "expired",
  "damaged",
  "melt_evaporation",
  "staff_consumption",
  "complimentary",
  "sampling",
] as const;

const ORDER_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  completed: "Completed",
  voided: "Voided",
  refunded: "Refunded",
  partially_refunded: "Part-refunded",
};
export function orderStatusLabel(s: string): string {
  return ORDER_STATUS_LABEL[s] ?? s;
}

/** Whole-IQD formatter, e.g. 12345 → "12,345 IQD". Display only: the database does the arithmetic. */
export function fmtIQD(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} IQD`;
}

/** A quantity, without float noise (0.30000000000000004 → "0.3"). */
export function fmtQty(n: number): string {
  return Number(n.toFixed(6)).toLocaleString("en-US", { maximumFractionDigits: 6 });
}
