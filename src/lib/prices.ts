/**
 * The price watch (round five): what came in dearer, and what it does to the
 * margins of what is sold. Pure: the page reads the deliveries, the recipes
 * and the menu's costs and gives them here, and a test can give its own.
 *
 * A rise is an item's latest delivery against the one before it, per base
 * unit, with what was shared out over the delivery (freight) where known. A
 * size it touches uses the item on its recipe, or through what is made from
 * it — milk in a base, the base in a gelato — and every serving then costs
 * what it uses of the item times the rise, once what was bought dearer is
 * what is sold. Its margin before is at the old price; after, at the new.
 */

/** A delivery of an item, newest first, as its price history has it. */
export interface Delivered {
  receivedAt: string;
  supplier: string | null;
  /** What a base unit cost, and with freight and the like shared out. */
  costPerBase: number | null;
  landedPerBase: number | null;
}

export interface Rise {
  /** What a base unit cost the time before, and this time. */
  was: number;
  now: number;
  /** As a fraction: 0.25 is a quarter more. */
  change: number;
  /** When it came, and from whom. */
  on: string;
  supplier: string | null;
}

/**
 * An item's latest delivery against the one before it: a rise of `least` or
 * more (5%), when the latest came on or after `since`; null otherwise.
 */
export function riseOf(history: Delivered[], since: string, least = 0.05): Rise | null {
  const priced = history
    .map((h) => ({ ...h, unit: h.landedPerBase ?? h.costPerBase }))
    .filter((h): h is typeof h & { unit: number } => h.unit !== null && h.unit > 0);
  const [latest, before] = priced;
  if (!latest || !before || latest.receivedAt.slice(0, 10) < since) return null;
  const change = (latest.unit - before.unit) / before.unit;
  if (change < least) return null;
  return {
    was: before.unit,
    now: latest.unit,
    change,
    on: latest.receivedAt,
    supplier: latest.supplier,
  };
}

/** A line of a size's recipe today, as the menu has it. */
export interface MenuLine {
  variantId: string;
  itemId: string | null;
  quantity: number;
  unitCode: string;
  /** The channels it is used on; null for every one. */
  channels: string[] | null;
}

/** A recipe made in batches: what one batch uses, in base units, and what it makes. */
export interface MadeRecipe {
  outputItemId: string;
  yieldBase: number;
  lines: { itemId: string; baseQty: number }[];
}

/**
 * What a base unit of each made item uses of an item, through every recipe
 * that makes it — a base, then a gelato made from the base.
 */
export function madeUses(itemId: string, made: MadeRecipe[]): Map<string, number> {
  const per = new Map<string, number>();
  // A chain is a few recipes long: each round reaches one step further.
  for (let round = 0; round < 6; round++) {
    let changed = false;
    for (const r of made) {
      if (!(r.yieldBase > 0)) continue;
      const used = r.lines.reduce(
        (s, l) => s + l.baseQty * (l.itemId === itemId ? 1 : (per.get(l.itemId) ?? 0)),
        0,
      );
      const each = used / r.yieldBase;
      if (each > 0 && per.get(r.outputItemId) !== each) {
        per.set(r.outputItemId, each);
        changed = true;
      }
    }
    if (!changed) break;
  }
  per.delete(itemId);
  return per;
}

/**
 * What a serving of each size uses of an item on a channel, in its base unit:
 * on its recipe (direct), and through what is made from it (made).
 */
export function servingUses(
  itemId: string,
  lines: MenuLine[],
  made: MadeRecipe[],
  factor: (itemId: string, unitCode: string) => number | null,
  channel: string,
): Map<string, { direct: number; made: number }> {
  const through = madeUses(itemId, made);
  const out = new Map<string, { direct: number; made: number }>();
  for (const l of lines) {
    if (!l.itemId || (l.channels && !l.channels.includes(channel))) continue;
    const f = factor(l.itemId, l.unitCode);
    if (f === null) continue;
    const base = l.quantity * f;
    const u = out.get(l.variantId) ?? { direct: 0, made: 0 };
    if (l.itemId === itemId) u.direct += base;
    else if (through.has(l.itemId)) u.made += base * through.get(l.itemId)!;
    else continue;
    out.set(l.variantId, u);
  }
  return out;
}

/** A size on a channel the rise touches. */
export interface Touch {
  variantId: string;
  channel: string;
  price: number;
  /** What the rise adds to a serving, once what was bought dearer is what is sold. */
  adds: number;
  /** What a serving costs at the old price, and at the new. */
  before: number;
  after: number;
  /** The margin at each, as a fraction of the price; null with no price. */
  marginBefore: number | null;
  marginAfter: number | null;
  /**
   * The price that keeps the margin it had, rounded up to `step`; null when
   * that is less than half a step above today's.
   */
  keep: number | null;
}

/**
 * What a rise does to a size's serving: its cost today (as a sale would post
 * it) with the item at its old price, then at its new.
 */
export function touch(
  rise: Rise,
  use: { direct: number; made: number },
  price: number,
  costNow: number,
  itemCostNow: number | null,
  step = 250,
): Omit<Touch, "variantId" | "channel"> {
  // Today's cost may hold the item at neither price (an average of what is on
  // hand): put the item on the recipe at the old price for "before".
  const before = costNow - use.direct * ((itemCostNow ?? rise.was) - rise.was);
  const adds = (use.direct + use.made) * (rise.now - rise.was);
  const after = before + adds;
  const marginBefore = price > 0 ? (price - before) / price : null;
  const marginAfter = price > 0 ? (price - after) / price : null;
  // The price that keeps the margin, exactly; a new price only when it is
  // half a step or more above today's (less is lost in the rounding).
  const needed =
    marginBefore !== null && marginBefore < 1 && step > 0 ? after / (1 - marginBefore) : null;
  return {
    price,
    adds,
    before,
    after,
    marginBefore,
    marginAfter,
    keep:
      needed !== null && needed - price >= step / 2 ? Math.ceil(needed / step - 1e-9) * step : null,
  };
}
