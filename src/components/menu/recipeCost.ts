/**
 * What a recipe costs, worked out while it is typed, the way the database
 * costs a sale (menu_costing): each ingredient's quantity in its base unit,
 * merged by item for the channel, times what the item costs today, rounded to
 * the currency unit (halves to even), then added up. The cost the product form
 * shows is therefore the cost the product's card shows once it is saved.
 */
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { SALES_CHANNELS } from "@/lib/validation";
import { parseNumber, roundMoney } from "@/components/pos/model";

/**
 * PostgreSQL multiplies numerics exactly. decimal.js keeps 20 significant
 * digits unless told otherwise, and at 20 a cost of 0.66666666666666666667 IQD
 * a gram times 0.75 g is exactly half a dinar, rounded down, where the
 * database's 0.5000000000000000000025 rounds up. 64 digits hold every product
 * of a cost the database sends and a quantity someone types.
 */
const Exact = Decimal.clone({ precision: 64 });

export interface CostedItem {
  id: string;
  baseUnit: string;
  units: { code: string; factor: number }[];
  /** What one base unit costs today, exactly as the database gave it; "0" if never bought. */
  unitCost: string;
}

export interface CostLine {
  itemId: string;
  quantity: string;
  unit: string;
  /** The channels the line is used on; empty means every channel. */
  channels: SalesChannel[];
}

/** Where a recipe line is used, as the form offers it. */
export type LineUse = "all" | "to_go" | "dine_in" | "custom";

/** Every channel but a table: where the cup, lid and bag are used. */
export const TO_GO: SalesChannel[] = SALES_CHANNELS.filter((c) => c !== "dine_in");

/**
 * The channels a line is saved with. Every channel ticked is every channel,
 * and so is none: the database reads an empty list as "all".
 */
export function channelsFor(
  use: LineUse,
  ticked: SalesChannel[],
  sellable: SalesChannel[],
): SalesChannel[] {
  if (use === "to_go") return TO_GO;
  if (use === "dine_in") return ["dine_in"];
  if (use === "custom" && !sellable.every((c) => ticked.includes(c))) return ticked;
  return [];
}

/** A line's quantity in its item's base unit; null until a quantity is typed. */
export function baseQty(line: CostLine, item: CostedItem | undefined): Decimal | null {
  const typed = parseNumber(line.quantity);
  if (!item || !typed || typed.lte(0)) return null;
  const q = new Exact(typed);
  if (line.unit === item.baseUnit) return q;
  const unit = item.units.find((u) => u.code === line.unit);
  return unit ? q.times(unit.factor) : null;
}

/** What one line adds to a serving where it is used; null until it has a quantity. */
export function lineCost(
  line: CostLine,
  item: CostedItem | undefined,
  decimals: number,
): Decimal | null {
  const q = baseQty(line, item);
  return q && item ? roundMoney(q.times(item.unitCost), decimals) : null;
}

const usedOn = (line: CostLine, channel: SalesChannel) =>
  line.channels.length === 0 || line.channels.includes(channel);

/** One serving on a channel: the lines used there, merged by item, each item rounded once. */
export function servingCost(
  lines: CostLine[],
  items: Map<string, CostedItem>,
  channel: SalesChannel,
  decimals: number,
): Decimal {
  const qty = new Map<string, Decimal>();
  for (const l of lines) {
    if (!usedOn(l, channel)) continue;
    const q = baseQty(l, items.get(l.itemId));
    if (q) qty.set(l.itemId, (qty.get(l.itemId) ?? new Exact(0)).plus(q));
  }
  let total = new Exact(0);
  for (const [id, q] of qty) {
    total = total.plus(roundMoney(q.times(items.get(id)!.unitCost), decimals));
  }
  return total;
}

/** What a price leaves over the cost, and that as a share of the price (null at no price). */
export function margin(
  price: Decimal,
  cost: Decimal,
): { amount: Decimal; percent: Decimal | null } {
  const amount = price.minus(cost);
  return { amount, percent: price.gt(0) ? amount.div(price).times(100) : null };
}

/**
 * The lowest price, in whole steps of the café's rounding (250 IQD), that
 * leaves at least the target margin; null with no cost to go by.
 */
export function suggestedPrice(cost: Decimal, targetMargin: Decimal, step: number): Decimal | null {
  if (cost.lte(0) || targetMargin.lt(0) || targetMargin.gte(100)) return null;
  const raw = cost.times(100).div(new Decimal(100).minus(targetMargin));
  const s = step > 0 ? step : 1;
  return raw.div(s).ceil().times(s);
}
