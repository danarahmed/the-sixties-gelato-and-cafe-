/**
 * Waste by recipe (round six): of what each recipe made over four weeks, what
 * was sold or went into other batches, what was thrown away, what was eaten
 * or given away, and what is still in stock, from each batch's lot as it
 * stands now; the share of what has gone that was thrown away, and its cost.
 * Where what was thrown away was mostly left unsold (past its use-by, spoilt),
 * the batch that would have covered what went: smaller batches would have
 * wasted less. Where it was mostly spilt, melted or made wrong, the size of
 * the batch is not the cause, and none is said. Pure: the page and the tests
 * read through here.
 */
import type { Story } from "./production";

/** Thrown away because it was not sold in time. */
export const UNSOLD = new Set(["expired", "spoilage", "waste"]);
/** Thrown away in the handling: dropped, melted, spoilt in the making. */
export const HANDLED = new Set([
  "damaged",
  "melt_evaporation",
  "production_waste",
  "preparation_waste",
]);
/** Not thrown away: eaten by the staff, given to a customer, tasted. */
export const GIVEN = new Set(["staff_consumption", "complimentary", "sampling"]);

/** Of what has gone, thrown away, before a recipe is said to waste. */
export const WASTES = 0.1;

/** A batch as the production report has it, with what its lot lost, by kind. */
export interface WasteBatch {
  batchId: string;
  recipe: string;
  item: string;
  baseUnit: string;
  status: string;
  /** What came out, in the base unit, and what the batch cost. */
  actual: number;
  value: number;
  story: Story | null;
  /** What the batch's lot lost, by the movement's kind, in the base unit (positive). */
  losses: Record<string, number>;
}

export interface RecipeWaste {
  recipe: string;
  item: string;
  baseUnit: string;
  batches: number;
  made: number;
  /** Sold, or went into other batches. */
  sold: number;
  thrown: number;
  /** Of what was thrown away: left unsold, and lost in the handling. */
  unsold: number;
  handled: number;
  /** Eaten by the staff, given away or tasted. */
  given: number;
  /** Still in stock, its end not yet known. */
  left: number;
  /** Of what has gone (what was made, less what is still in stock), the share thrown away. */
  share: number | null;
  /** What was thrown away cost, each batch at its own cost. */
  value: number;
  /** What was given or eaten cost. */
  givenValue: number;
  /** What has gone cost: the share thrown away, in money, is `value` over it. */
  goneValue: number;
  /** Batches still in stock, their end not yet known. */
  open: number;
  /** A batch on average, of the batches all gone: what it made, and what of it went other than to the bin. */
  perBatch: number | null;
  takenPerBatch: number | null;
  /** The batch that would have covered what went; null unless it was mostly left unsold. */
  better: number | null;
}

/** What each recipe's batches came to, the costliest waste first. */
export function recipeWaste(batches: WasteBatch[]): RecipeWaste[] {
  const groups = new Map<string, WasteBatch[]>();
  for (const b of batches) {
    if (b.status === "cancelled" || !b.story) continue;
    const list = groups.get(b.recipe) ?? [];
    list.push(b);
    groups.set(b.recipe, list);
  }
  const out: RecipeWaste[] = [];
  for (const [recipe, list] of groups) {
    let made = 0;
    let sold = 0;
    let thrown = 0;
    let unsold = 0;
    let handled = 0;
    let given = 0;
    let left = 0;
    let value = 0;
    let givenValue = 0;
    let goneValue = 0;
    let open = 0;
    let finished = 0;
    let finishedMade = 0;
    let finishedTaken = 0;
    for (const b of list) {
      const s = b.story!;
      const of = (kinds: Set<string>) =>
        Object.entries(b.losses).reduce((n, [k, q]) => (kinds.has(k) ? n + q : n), 0);
      const g = of(GIVEN);
      // What the lot lost, less what was eaten or given: a loss taken back on review is in it.
      const t = Math.max(0, s.lost - g);
      const unit = b.actual > 0 ? b.value / b.actual : 0;
      made += s.made;
      sold += s.sold + s.used;
      thrown += t;
      unsold += of(UNSOLD);
      handled += of(HANDLED);
      given += g;
      left += s.left;
      value += t * unit;
      givenValue += g * unit;
      goneValue += Math.max(0, s.made - s.left) * unit;
      if (s.left > 0) open += 1;
      if (s.left <= 0 && s.made > 0) {
        finished += 1;
        finishedMade += s.made;
        finishedTaken += s.sold + s.used + g;
      }
    }
    const gone = made - left;
    const share = gone > 0 ? thrown / gone : null;
    const perBatch = finished ? finishedMade / finished : null;
    const takenPerBatch = finished ? finishedTaken / finished : null;
    const mostlyUnsold = unsold > 0 && unsold >= handled;
    out.push({
      recipe,
      item: list[0]!.item,
      baseUnit: list[0]!.baseUnit,
      batches: list.length,
      made,
      sold,
      thrown,
      unsold,
      handled,
      given,
      left,
      share,
      value,
      givenValue,
      goneValue,
      open,
      perBatch,
      takenPerBatch,
      better:
        share !== null &&
        share >= WASTES &&
        mostlyUnsold &&
        finished >= 2 &&
        takenPerBatch !== null &&
        perBatch !== null &&
        takenPerBatch < perBatch
          ? takenPerBatch
          : null,
    });
  }
  return out.sort(
    (a, b) => b.value - a.value || b.thrown - a.thrown || a.recipe.localeCompare(b.recipe),
  );
}

/**
 * A quantity in the base unit as read: a kilo or a litre from a thousand
 * grams or millilitres, to a tenth below ten; otherwise as it is, whole.
 * Rounded down, for a batch to make: "3.9 kg", not "4 kg" for 3.95.
 */
export function bigQty(base: number, unit: string, down = false): { qty: string; unit: string } {
  const round = (n: number, step: number) =>
    (down ? Math.floor(n / step + 1e-9) : Math.round(n / step)) * step;
  const big = unit === "g" ? "kg" : unit === "ml" ? "L" : null;
  if (big && Math.abs(base) >= 1000) {
    const n = base / 1000;
    const v = Math.abs(n) < 10 ? round(n, 0.1) : round(n, 1);
    return { qty: v.toLocaleString("en-US", { maximumFractionDigits: 1 }), unit: big };
  }
  return { qty: round(base, 1).toLocaleString("en-US"), unit };
}

/** An item thrown away unsold in a week (0070's waste_coach), against the week before. */
export interface WasteWeekItem {
  itemId: string;
  item: string;
  unit: string;
  qty: number;
  value: number;
  /** How many times it was thrown away, and on which weekdays (1 Monday … 7 Sunday). */
  times: number;
  weekdays: number[];
  qtyBefore: number;
  valueBefore: number;
  /** Made here (a batch recipe's output), or bought. */
  made: boolean;
  /** The days it keeps once it comes, as said on What to buy; null when not said. */
  keepsDays: number | null;
}

/** What was thrown away unsold in the seven days to a day, and the seven before (0070). */
export interface WasteWeek {
  from: string;
  to: string;
  value: number;
  valueBefore: number;
  items: WasteWeekItem[];
}

const n = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

export function wasteWeekFrom(v: unknown): WasteWeek | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const items = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : [];
  return {
    from: s(o.from),
    to: s(o.to),
    value: n(o.value),
    valueBefore: n(o.value_before),
    items: items.map((i) => ({
      itemId: s(i.item_id),
      item: s(i.item),
      unit: s(i.unit),
      qty: n(i.qty),
      value: n(i.value),
      times: n(i.times),
      weekdays: Array.isArray(i.weekdays)
        ? i.weekdays.map(Number).filter((d) => d >= 1 && d <= 7)
        : [],
      qtyBefore: n(i.qty_before),
      valueBefore: n(i.value_before),
      made: i.made === true,
      keepsDays: i.keeps_days === null || i.keeps_days === undefined ? null : Number(i.keeps_days),
    })),
  };
}

/**
 * What to try about an item thrown away: made here, the day's plan already
 * makes less of what is thrown away often (0070), and the batch on its days is
 * worth a look; bought, say how long it keeps, so What to buy orders no more
 * than it will use; said already, order less at a time.
 */
export type WasteTip = "made" | "say_keeps" | "order_less";

export function wasteTip(i: Pick<WasteWeekItem, "made" | "keepsDays">): WasteTip {
  if (i.made) return "made";
  return i.keepsDays === null ? "say_keeps" : "order_less";
}

/** The week's items worth a word: thrown away this week, the costliest first. */
export function weekWorst(w: WasteWeek, most = 5): WasteWeekItem[] {
  return w.items.filter((i) => i.qty > 0).slice(0, most);
}
